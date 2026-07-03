use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use log::{debug, info, warn};
use opendal::{Entry, Metadata, Operator};
use serde::{Deserialize, Serialize};
use zip::{write::FileOptions, CompressionMethod, ZipWriter};

use crate::core::error::{Error, Result};

/// 上传分块大小（1MB），用于分块读取并上报进度
const UPLOAD_CHUNK_SIZE: usize = 1024 * 1024;

/// 检查取消标志是否已被置位；flag 为 None 时视为不可取消
fn is_cancelled(flag: &Option<Arc<AtomicBool>>) -> bool {
    match flag {
        Some(f) => f.load(Ordering::Relaxed),
        None => false,
    }
}

/// 目录上传结果：汇总成功/失败文件数，便于上层区分"全部成功"与"部分成功"
#[derive(Debug, Clone, Copy, Default, Serialize)]
pub struct DirectoryUploadResult {
    /// 成功上传的文件数
    pub uploaded: usize,
    /// 上传失败的文件数
    pub failed: usize,
    /// 目录中的文件总数
    pub total: usize,
}

impl DirectoryUploadResult {
    /// 是否全部上传成功
    pub fn is_full_success(&self) -> bool {
        self.failed == 0
    }
}

/// 文件信息结构体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
    pub modified: Option<String>,
}

/// 文件管理器结构体，提供高级文件操作接口
pub struct FileManager {
    operator: Operator,
}

impl FileManager {
    /// 创建新的文件管理器
    pub fn new(operator: Operator) -> Self {
        Self { operator }
    }

    /// 列出给定路径下的文件和目录
    pub async fn list(&self, path: &str) -> Result<Vec<Entry>> {
        debug!("列出路径内容: {}", path);

        let path = normalize_path(path);

        // 获取目录列表
        let result = self.operator.list(&path).await?;

        info!("已列出 {} 个文件/目录", result.len());
        Ok(result)
    }

    /// 分页列出给定路径下的文件和目录
    pub async fn list_paginated(
        &self,
        path: &str,
        page: usize,
        page_size: usize,
    ) -> Result<(Vec<Entry>, usize)> {
        debug!(
            "分页列出路径内容: {} (页码: {}, 每页: {})",
            path, page, page_size
        );

        let path = normalize_path(path);

        // 获取完整目录列表
        let mut all_entries = self.operator.list(&path).await?;

        // 按名称排序，目录在前
        all_entries.sort_by(
            |a, b| match (a.metadata().is_dir(), b.metadata().is_dir()) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name().cmp(b.name()),
            },
        );

        let total_count = all_entries.len();
        let start_idx = page * page_size;
        let end_idx = std::cmp::min(start_idx + page_size, total_count);

        let paginated_entries = if start_idx < total_count {
            all_entries[start_idx..end_idx].to_vec()
        } else {
            Vec::new()
        };

        info!(
            "已列出 {}/{} 个文件/目录 (页码: {})",
            paginated_entries.len(),
            total_count,
            page
        );
        Ok((paginated_entries, total_count))
    }

    /// 上传文件
    pub async fn upload(&self, local_path: &Path, remote_path: &str) -> Result<()> {
        self.upload_with_progress(local_path, remote_path, |_, _, _| {}, None)
            .await
    }

    /// 分块上传文件，并通过回调上报进度（transferred, total, file_name）。
    ///
    /// `cancel_flag` 不为 None 时，每写入一个分块前会检查该标志，
    /// 若已被置位则中止上传（abort writer）并返回取消错误。
    pub async fn upload_with_progress<F>(
        &self,
        local_path: &Path,
        remote_path: &str,
        mut progress_callback: F,
        cancel_flag: Option<Arc<AtomicBool>>,
    ) -> Result<()>
    where
        F: FnMut(u64, u64, &str) + Send,
    {
        debug!("上传文件: {} -> {}", local_path.display(), remote_path);

        if !local_path.exists() {
            return Err(Error::new_not_found(&format!(
                "本地文件不存在: {}",
                local_path.display()
            )));
        }

        let remote_path = normalize_path(remote_path);
        let total_size = std::fs::metadata(local_path)?.len();
        let file_name = local_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "uploaded_file".to_string());

        progress_callback(0, total_size, &file_name);

        let mut writer = self.operator.writer(&remote_path).await?;

        // 上传主体放入闭包，便于在任意步骤失败时统一清理 writer，
        // 避免远程端（如 S3 multipart）残留未关闭/未提交的写入句柄。
        let upload_result: Result<()> = async {
            let mut file = File::open(local_path)?;
            let mut buffer = vec![0u8; UPLOAD_CHUNK_SIZE];
            let mut transferred = 0u64;

            loop {
                // 取消检查点：在每个分块写入前检查，及时响应用户取消
                if is_cancelled(&cancel_flag) {
                    return Err(Error::new_cancelled("上传已被用户取消"));
                }
                let n = file.read(&mut buffer)?;
                if n == 0 {
                    break;
                }
                writer.write(buffer[..n].to_vec()).await?;
                transferred += n as u64;
                progress_callback(transferred, total_size, &file_name);
            }
            Ok(())
        }
        .await;

        match upload_result {
            Ok(()) => {
                // 全部写入完成后提交；close 失败视为整体失败
                writer.close().await?;
                info!("文件上传成功: {} -> {}", local_path.display(), remote_path);
                Ok(())
            }
            Err(e) => {
                // 主动中止以清理远程端可能残留的 multipart 分片，
                // abort 本身的错误不覆盖原始上传错误。
                let _ = writer.abort().await;
                Err(e)
            }
        }
    }

    /// 上传整个目录（递归上传文件夹内的所有文件，保持目录结构）
    pub async fn upload_directory(
        &self,
        local_dir_path: &Path,
        remote_base_path: &str,
    ) -> Result<DirectoryUploadResult> {
        self.upload_directory_with_progress(
            local_dir_path,
            remote_base_path,
            |_, _, _, _, _, _| {},
            None,
        )
        .await
    }

    /// 上传整个目录，并通过回调上报进度
    /// 回调参数：(file_index, file_count, transferred, file_total, file_name, error)
    /// - 进行中：error 为 None
    /// - 单文件失败：error 为 Some(错误信息)，目录上传继续处理后续文件
    /// - 用户取消：立即停止上传剩余文件，返回取消错误
    pub async fn upload_directory_with_progress<F>(
        &self,
        local_dir_path: &Path,
        remote_base_path: &str,
        mut progress_callback: F,
        cancel_flag: Option<Arc<AtomicBool>>,
    ) -> Result<DirectoryUploadResult>
    where
        F: FnMut(usize, usize, u64, u64, &str, Option<&str>) + Send,
    {
        debug!(
            "上传目录: {} -> {}",
            local_dir_path.display(),
            remote_base_path
        );

        if !local_dir_path.exists() {
            return Err(Error::new_not_found(&format!(
                "本地目录不存在: {}",
                local_dir_path.display()
            )));
        }

        if !local_dir_path.is_dir() {
            return Err(Error::new_config(&format!(
                "路径不是目录: {}",
                local_dir_path.display()
            )));
        }

        let upload_items = collect_directory_upload_items(local_dir_path, remote_base_path)?;
        let file_count = upload_items.len();
        let mut uploaded_count = 0;
        let mut failed_count = 0;

        // 预先创建远程目录
        let mut remote_dirs = std::collections::HashSet::new();
        for (_, remote_path) in &upload_items {
            if let Some(parent) = remote_path.rsplit_once('/') {
                if !parent.0.is_empty() {
                    remote_dirs.insert(format!("{}/", parent.0));
                }
            }
        }
        for remote_dir in remote_dirs {
            if let Err(e) = self.create_dir(&remote_dir).await {
                debug!("创建远程目录失败 {}: {}", remote_dir, e);
            }
        }

        for (file_index, (path, remote_path)) in upload_items.into_iter().enumerate() {
            // 每个文件上传前检查取消标志：取消后不再上传剩余文件
            if is_cancelled(&cancel_flag) {
                info!(
                    "目录上传已被用户取消: {} (已成功 {}/{})",
                    local_dir_path.display(),
                    uploaded_count,
                    file_count
                );
                return Err(Error::new_cancelled("上传已被用户取消"));
            }

            let file_name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| remote_path.clone());

            match self
                .upload_with_progress(
                    &path,
                    &remote_path,
                    |transferred, total, _| {
                        progress_callback(
                            file_index + 1,
                            file_count,
                            transferred,
                            total,
                            &file_name,
                            None,
                        );
                    },
                    cancel_flag.clone(),
                )
                .await
            {
                Ok(_) => {
                    uploaded_count += 1;
                    info!(
                        "文件上传成功 ({}/{}): {} -> {}",
                        uploaded_count,
                        file_count,
                        path.display(),
                        remote_path
                    );
                }
                Err(e) if e.is_cancelled() => {
                    // 单文件上传过程中被取消：停止整个目录上传
                    info!(
                        "目录上传已被用户取消: {} (已成功 {}/{})",
                        local_dir_path.display(),
                        uploaded_count,
                        file_count
                    );
                    return Err(e);
                }
                Err(e) => {
                    // 单文件失败不再静默：通过回调上报错误，让上层提示用户，
                    // 同时继续上传其余文件以保证目录上传的容错性。
                    failed_count += 1;
                    let err_msg = e.to_string();
                    warn!(
                        "上传文件失败 ({}/{}): {} -> {}",
                        file_index + 1,
                        file_count,
                        path.display(),
                        err_msg
                    );
                    progress_callback(file_index + 1, file_count, 0, 0, &file_name, Some(&err_msg));
                }
            }
        }

        let result = DirectoryUploadResult {
            uploaded: uploaded_count,
            failed: failed_count,
            total: file_count,
        };
        info!(
            "目录上传完成: {} (成功 {}/{})",
            local_dir_path.display(),
            result.uploaded,
            result.total
        );
        Ok(result)
    }

    /// 检查远程路径是否存在，返回 (是否存在, 是否为目录)
    pub async fn path_exists(&self, path: &str) -> Result<(bool, bool)> {
        let path = normalize_path(path);
        if !self.operator.exists(&path).await? {
            return Ok((false, false));
        }
        let metadata = self.operator.stat(&path).await?;
        Ok((true, metadata.is_dir()))
    }

    /// 下载文件
    pub async fn download(&self, remote_path: &str, local_path: &Path) -> Result<()> {
        debug!("下载文件: {} -> {}", remote_path, local_path.display());

        let remote_path = normalize_path(remote_path);

        // 检查远程文件是否存在
        if !self.operator.exists(&remote_path).await? {
            return Err(Error::new_not_found(&format!(
                "远程文件不存在: {}",
                remote_path
            )));
        }

        // 创建本地目录（如果需要）
        if let Some(parent) = local_path.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent)?;
            }
        }

        let data = self.operator.read(&remote_path).await?;
        let mut file = File::create(local_path)?;
        file.write_all(&data.to_bytes())?;

        info!("文件下载成功: {} -> {}", remote_path, local_path.display());
        Ok(())
    }

    /// 下载带进度的大文件
    pub async fn download_with_progress<F>(
        &self,
        remote_path: &str,
        local_path: &Path,
        mut progress_callback: F,
    ) -> Result<()>
    where
        F: FnMut(u64, u64) + Send + Sync,
    {
        debug!("下载大文件: {} -> {}", remote_path, local_path.display());

        let remote_path = normalize_path(remote_path);

        // 检查远程文件是否存在并获取文件大小
        let metadata = self.operator.stat(&remote_path).await?;
        let total_size = metadata.content_length();

        // 创建本地目录（如果需要）
        if let Some(parent) = local_path.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent)?;
            }
        }

        // 直接读取全部数据
        let data = self.operator.read(&remote_path).await?;
        progress_callback(data.len() as u64, total_size);

        let mut file = File::create(local_path)?;
        file.write_all(&data.to_bytes())?;

        info!(
            "大文件下载成功: {} -> {}",
            remote_path,
            local_path.display()
        );
        Ok(())
    }

    /// 删除文件或目录（目录会递归删除）
    pub async fn delete(&self, path: &str) -> Result<()> {
        debug!("删除文件或目录: {}", path);

        let path = normalize_path(path);

        // 检查路径是否存在
        if !self.operator.exists(&path).await? {
            return Err(Error::new_not_found(&format!("路径不存在: {}", path)));
        }

        // 获取元数据以判断是文件还是目录
        let metadata = self.operator.stat(&path).await?;

        if metadata.is_dir() {
            // 如果是目录，使用 remove_all 递归删除
            debug!("递归删除目录: {}", path);
            self.operator.remove_all(&path).await?;
            info!("目录删除成功: {}", path);
        } else {
            // 如果是文件，直接删除
            self.operator.delete(&path).await?;
            info!("文件删除成功: {}", path);
        }

        Ok(())
    }

    /// 获取文件元数据
    pub async fn stat(&self, path: &str) -> Result<Metadata> {
        debug!("获取文件元数据: {}", path);

        let path = normalize_path(path);
        let meta = self.operator.stat(&path).await?;

        debug!(
            "获取到元数据: 大小={}, 最后修改时间={:?}",
            meta.content_length(),
            meta.last_modified()
        );

        Ok(meta)
    }

    /// 创建目录
    pub async fn create_dir(&self, path: &str) -> Result<()> {
        debug!("创建目录: {}", path);

        let path = normalize_path(path);
        if !path.ends_with('/') {
            return Err(Error::new_config("目录路径必须以 '/' 结尾"));
        }

        self.operator.create_dir(&path).await?;

        info!("目录创建成功: {}", path);
        Ok(())
    }

    /// 分页搜索文件和目录
    pub async fn search_paginated(
        &self,
        path: &str,
        query: &str,
        page: usize,
        page_size: usize,
    ) -> Result<(Vec<Entry>, usize)> {
        debug!(
            "分页搜索文件: 路径={}, 查询={}, 页码={}, 每页={}",
            path, query, page, page_size
        );

        let path = normalize_path(path);

        // 获取完整目录列表
        let all_entries = self.operator.list(&path).await?;

        // 过滤匹配查询的文件
        let query_lower = query.to_lowercase();
        let mut filtered_entries: Vec<Entry> = all_entries
            .into_iter()
            .filter(|entry| entry.name().to_lowercase().contains(&query_lower))
            .collect();

        // 按名称排序，目录在前
        filtered_entries.sort_by(
            |a, b| match (a.metadata().is_dir(), b.metadata().is_dir()) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name().cmp(b.name()),
            },
        );

        let total_count = filtered_entries.len();
        let start_idx = page * page_size;
        let end_idx = std::cmp::min(start_idx + page_size, total_count);

        let paginated_entries = if start_idx < total_count {
            filtered_entries[start_idx..end_idx].to_vec()
        } else {
            Vec::new()
        };

        info!(
            "搜索到 {}/{} 个匹配的文件/目录 (页码: {})",
            paginated_entries.len(),
            total_count,
            page
        );
        Ok((paginated_entries, total_count))
    }

    /// 获取文件信息
    pub async fn get_file_info(&self, path: &str) -> Result<Option<FileInfo>> {
        debug!("获取文件信息: {}", path);

        let path = normalize_path(path);

        // 检查文件是否存在
        if !self.operator.exists(&path).await? {
            return Ok(None);
        }

        // 获取文件元数据
        let metadata = self.operator.stat(&path).await?;

        let file_info = FileInfo {
            name: path.split('/').next_back().unwrap_or(&path).to_string(),
            path: if path.is_empty() {
                "/".to_string()
            } else {
                format!("/{}", path)
            },
            is_dir: metadata.is_dir(),
            size: if metadata.is_file() {
                Some(metadata.content_length())
            } else {
                None
            },
            modified: metadata.last_modified().map(|dt| dt.to_rfc3339()),
        };

        debug!("获取到文件信息: {:?}", file_info);
        Ok(Some(file_info))
    }

    /// 读取文件内容
    pub async fn read_file(&self, path: &str) -> Result<opendal::Buffer> {
        debug!("读取文件内容: {}", path);

        let path = normalize_path(path);

        // 检查文件是否存在
        if !self.operator.exists(&path).await? {
            return Err(Error::new_not_found(&format!("文件不存在: {}", path)));
        }

        let content = self.operator.read(&path).await?;

        info!("文件读取成功: {} ({} 字节)", path, content.len());
        Ok(content)
    }

    /// 批量下载文件并打包成ZIP（支持文件夹递归下载）
    pub async fn batch_download_as_zip(
        &self,
        file_paths: &[String],
        save_path: &str,
    ) -> Result<()> {
        info!("开始批量下载 {} 个项目到: {}", file_paths.len(), save_path);

        // 创建本地目录（如果需要）
        if let Some(parent) = Path::new(save_path).parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent)?;
            }
        }

        let file = File::create(save_path)?;
        let mut zip = ZipWriter::new(file);
        let options = FileOptions::default()
            .compression_method(CompressionMethod::Deflated)
            .unix_permissions(0o755);

        // 收集所有需要下载的文件路径
        let mut all_files_to_download = Vec::new();

        for file_path in file_paths {
            let normalized_path = normalize_path(file_path);

            // 检查路径是否存在
            if !self.operator.exists(&normalized_path).await? {
                debug!("跳过不存在的路径: {}", file_path);
                continue;
            }

            // 获取元数据
            let metadata = self.operator.stat(&normalized_path).await?;

            if metadata.is_dir() {
                // 如果是目录，递归获取所有文件
                debug!("递归处理目录: {}", file_path);
                match self.list_files_recursive(file_path).await {
                    Ok(recursive_files) => {
                        all_files_to_download.extend(recursive_files);
                    }
                    Err(e) => {
                        debug!("递归列出目录 {} 失败: {}", file_path, e);
                        continue;
                    }
                }
            } else {
                // 如果是文件，直接添加
                all_files_to_download.push(file_path.clone());
            }
        }

        info!("总共需要下载 {} 个文件", all_files_to_download.len());

        // 下载所有文件到ZIP
        for (index, file_path) in all_files_to_download.iter().enumerate() {
            debug!(
                "下载文件 {}/{}: {}",
                index + 1,
                all_files_to_download.len(),
                file_path
            );

            let normalized_path = normalize_path(file_path);

            // 再次检查文件是否存在（防止递归过程中文件被删除）
            if !self.operator.exists(&normalized_path).await? {
                debug!("跳过不存在的文件: {}", file_path);
                continue;
            }

            // 读取文件内容
            match self.operator.read(&normalized_path).await {
                Ok(data) => {
                    // 生成ZIP内的文件名（去掉前导斜杠）
                    let archive_name = file_path.strip_prefix('/').unwrap_or(file_path);

                    // 添加文件到ZIP
                    if let Err(e) = zip.start_file(archive_name, options) {
                        debug!("创建ZIP文件条目失败 {}: {}", archive_name, e);
                        continue;
                    }

                    if let Err(e) = zip.write_all(&data.to_bytes()) {
                        debug!("写入ZIP文件数据失败 {}: {}", archive_name, e);
                        continue;
                    }
                }
                Err(e) => {
                    debug!("读取文件内容失败 {}: {}", file_path, e);
                    continue;
                }
            }
        }

        zip.finish()?;
        info!("批量下载完成，ZIP文件保存到: {}", save_path);
        Ok(())
    }

    /// 递归列出目录下的所有文件（不包括目录）- 使用迭代方式避免递归问题
    pub async fn list_files_recursive(&self, path: &str) -> Result<Vec<String>> {
        debug!("递归列出目录下所有文件: {}", path);

        let mut all_files = std::collections::HashSet::new(); // 使用HashSet防止重复
        let mut dirs_to_visit = vec![path.to_string()];
        let mut visited_dirs = std::collections::HashSet::new();
        let max_items = 1000; // 防止无限制地收集文件

        while let Some(current_dir) = dirs_to_visit.pop() {
            // 规范化当前目录路径，确保一致性
            let normalized_current_dir = if current_dir.starts_with('/') {
                current_dir.clone()
            } else {
                format!("/{}", current_dir)
            };

            // 防止无限循环
            if visited_dirs.contains(&normalized_current_dir) {
                debug!("跳过已访问的目录: {}", normalized_current_dir);
                continue;
            }
            visited_dirs.insert(normalized_current_dir.clone());

            // 限制文件数量，防止内存溢出
            if all_files.len() >= max_items {
                debug!("达到最大文件数量限制 {}, 停止递归", max_items);
                break;
            }

            let normalized_path = normalize_path(&current_dir);

            // 确保路径以 / 结尾（对于目录）
            let list_path = if normalized_path.is_empty() {
                "".to_string()
            } else if normalized_path.ends_with('/') {
                normalized_path
            } else {
                format!("{}/", normalized_path)
            };

            debug!("处理目录: {} (原始路径: {})", list_path, current_dir);

            // 获取目录内容
            match self.operator.list(&list_path).await {
                Ok(entries) => {
                    debug!("目录 {} 包含 {} 个条目", list_path, entries.len());

                    for entry in entries {
                        let entry_name = entry.name();
                        let entry_path = entry.path();

                        // 跳过特殊目录
                        if entry_name == "." || entry_name == ".." {
                            continue;
                        }

                        if entry.metadata().is_dir() {
                            // 如果是目录，添加到待访问列表
                            let sub_dir_path = if entry_path.starts_with('/') {
                                entry_path.to_string()
                            } else {
                                format!("/{}", entry_path)
                            };

                            debug!("发现子目录: {}", sub_dir_path);

                            // 防止重复添加目录，使用规范化的路径进行比较
                            if !visited_dirs.contains(&sub_dir_path) {
                                dirs_to_visit.push(sub_dir_path);
                            }
                        } else {
                            // 添加文件到结果，使用规范化的路径
                            let file_path = if entry_path.starts_with('/') {
                                entry_path.to_string()
                            } else {
                                format!("/{}", entry_path)
                            };

                            debug!("找到文件: {}", file_path);
                            // 使用HashSet自动去重
                            all_files.insert(file_path);
                        }
                    }
                }
                Err(e) => {
                    debug!("无法列出目录 {}: {}", list_path, e);
                    // 继续处理其他目录
                    continue;
                }
            }
        }

        // 将HashSet转换为Vec并排序
        let mut result: Vec<String> = all_files.into_iter().collect();
        result.sort();

        info!("递归找到 {} 个文件", result.len());
        Ok(result)
    }
}

/// 收集目录中所有待上传文件的本地路径与远程路径
fn collect_directory_upload_items(
    local_dir_path: &Path,
    remote_base_path: &str,
) -> Result<Vec<(std::path::PathBuf, String)>> {
    let mut items = Vec::new();
    let mut dirs_to_visit = vec![local_dir_path.to_path_buf()];
    let local_base = local_dir_path.parent().unwrap_or(local_dir_path);

    while let Some(current_dir) = dirs_to_visit.pop() {
        let entries = match std::fs::read_dir(&current_dir) {
            Ok(entries) => entries,
            Err(e) => {
                debug!("无法读取目录 {}: {}", current_dir.display(), e);
                continue;
            }
        };

        for entry in entries {
            let entry = match entry {
                Ok(entry) => entry,
                Err(e) => {
                    debug!("读取目录项失败: {}", e);
                    continue;
                }
            };

            let path = entry.path();
            let metadata = match entry.metadata() {
                Ok(metadata) => metadata,
                Err(e) => {
                    debug!("获取元数据失败 {}: {}", path.display(), e);
                    continue;
                }
            };

            let relative_path = match path.strip_prefix(local_base) {
                Ok(rel_path) => rel_path,
                Err(_) => {
                    debug!("无法获取相对路径: {}", path.display());
                    continue;
                }
            };

            let remote_path = if remote_base_path.is_empty() || remote_base_path == "/" {
                relative_path.to_string_lossy().replace('\\', "/")
            } else {
                format!(
                    "{}/{}",
                    remote_base_path.trim_end_matches('/'),
                    relative_path.to_string_lossy().replace('\\', "/")
                )
            };

            if metadata.is_dir() {
                dirs_to_visit.push(path);
            } else if metadata.is_file() {
                items.push((path, remote_path));
            }
        }
    }

    Ok(items)
}

/// 规范化路径，处理开头的斜杠
fn normalize_path(path: &str) -> String {
    let mut path = path.to_string();

    // 移除开头的斜杠，OpenDAL 默认不需要
    if path.starts_with('/') {
        path.remove(0);
    }

    path
}

#[cfg(test)]
mod tests {
    use super::*;
    use opendal::{services, Operator};
    use tempfile::TempDir;
    use tokio;

    /// 创建一个测试用的内存文件系统
    async fn create_test_operator() -> (Operator, tempfile::TempDir) {
        let temp_dir = tempfile::TempDir::new().expect("Failed to create temp directory");

        // 使用 fs 服务创建测试操作符
        let mut builder = services::Fs::default();
        let root_path = temp_dir.path().to_str().unwrap();
        builder = builder.root(root_path);

        let operator = Operator::new(builder)
            .expect("Failed to create operator")
            .finish();

        (operator, temp_dir)
    }

    /// 创建测试文件结构
    async fn setup_test_files(operator: &Operator) -> Result<()> {
        // 创建测试目录结构
        // /
        // ├── file1.txt
        // ├── file2.txt
        // ├── dir1/
        // │   ├── file3.txt
        // │   └── subdir1/
        // │       └── file4.txt
        // └── dir2/
        //     ├── file5.txt
        //     └── empty_dir/

        // 创建根文件
        operator.write("file1.txt", "content of file1").await?;
        operator.write("file2.txt", "content of file2").await?;

        // 创建目录
        operator.create_dir("dir1/").await?;
        operator.create_dir("dir1/subdir1/").await?;
        operator.create_dir("dir2/").await?;
        operator.create_dir("dir2/empty_dir/").await?;

        // 创建目录中的文件
        operator.write("dir1/file3.txt", "content of file3").await?;
        operator
            .write("dir1/subdir1/file4.txt", "content of file4")
            .await?;
        operator.write("dir2/file5.txt", "content of file5").await?;

        Ok(())
    }

    #[tokio::test]
    async fn test_list_files_recursive_simple() {
        let (operator, _temp_dir) = create_test_operator().await;
        let file_manager = FileManager::new(operator);

        // 设置测试文件
        setup_test_files(&file_manager.operator).await.unwrap();

        // 测试递归列出根目录的所有文件
        let files = file_manager.list_files_recursive("/").await.unwrap();

        println!("Found files: {:?}", files);

        // 验证找到了所有文件
        assert_eq!(files.len(), 5);

        // 验证文件路径
        let mut expected_files = vec![
            "/file1.txt",
            "/file2.txt",
            "/dir1/file3.txt",
            "/dir1/subdir1/file4.txt",
            "/dir2/file5.txt",
        ];
        expected_files.sort();

        let mut actual_files = files.clone();
        actual_files.sort();

        assert_eq!(actual_files, expected_files);
    }

    #[tokio::test]
    async fn test_list_files_recursive_specific_dir() {
        let (operator, _temp_dir) = create_test_operator().await;
        let file_manager = FileManager::new(operator);

        // 设置测试文件
        setup_test_files(&file_manager.operator).await.unwrap();

        // 测试递归列出特定目录的文件
        let files = file_manager.list_files_recursive("/dir1").await.unwrap();

        println!("Found files in dir1: {:?}", files);

        // 验证找到了 dir1 下的所有文件
        assert_eq!(files.len(), 2);

        let mut expected_files = vec!["/dir1/file3.txt", "/dir1/subdir1/file4.txt"];
        expected_files.sort();

        let mut actual_files = files.clone();
        actual_files.sort();

        assert_eq!(actual_files, expected_files);
    }

    #[tokio::test]
    async fn test_list_files_recursive_empty_dir() {
        let (operator, _temp_dir) = create_test_operator().await;
        let file_manager = FileManager::new(operator);

        // 只创建空目录
        file_manager.operator.create_dir("empty/").await.unwrap();

        // 测试递归列出空目录
        let files = file_manager.list_files_recursive("/empty").await.unwrap();

        // 空目录应该返回空列表
        assert_eq!(files.len(), 0);
    }

    #[tokio::test]
    async fn test_batch_download_single_file() {
        let (operator, _temp_dir) = create_test_operator().await;
        let file_manager = FileManager::new(operator);

        // 设置测试文件
        setup_test_files(&file_manager.operator).await.unwrap();

        // 创建临时ZIP文件
        let temp_zip = TempDir::new().unwrap();
        let zip_path = temp_zip.path().join("test.zip");

        // 测试下载单个文件
        let file_paths = vec!["/file1.txt".to_string()];
        let result = file_manager
            .batch_download_as_zip(&file_paths, zip_path.to_str().unwrap())
            .await;

        assert!(result.is_ok());
        assert!(zip_path.exists());
    }

    #[tokio::test]
    async fn test_batch_download_directory() {
        let (operator, _temp_dir) = create_test_operator().await;
        let file_manager = FileManager::new(operator);

        // 设置测试文件
        setup_test_files(&file_manager.operator).await.unwrap();

        // 创建临时ZIP文件
        let temp_zip = TempDir::new().unwrap();
        let zip_path = temp_zip.path().join("test_dir.zip");

        // 测试下载整个目录
        let file_paths = vec!["/dir1".to_string()];
        let result = file_manager
            .batch_download_as_zip(&file_paths, zip_path.to_str().unwrap())
            .await;

        assert!(result.is_ok());
        assert!(zip_path.exists());

        // 验证ZIP文件大小大于0
        let metadata = std::fs::metadata(&zip_path).unwrap();
        assert!(metadata.len() > 0);
    }

    #[tokio::test]
    async fn test_batch_download_mixed_files_and_dirs() {
        let (operator, _temp_dir) = create_test_operator().await;
        let file_manager = FileManager::new(operator);

        // 设置测试文件
        setup_test_files(&file_manager.operator).await.unwrap();

        // 创建临时ZIP文件
        let temp_zip = TempDir::new().unwrap();
        let zip_path = temp_zip.path().join("test_mixed.zip");

        // 测试下载混合的文件和目录
        let file_paths = vec![
            "/file1.txt".to_string(),
            "/dir1".to_string(),
            "/file2.txt".to_string(),
        ];
        let result = file_manager
            .batch_download_as_zip(&file_paths, zip_path.to_str().unwrap())
            .await;

        assert!(result.is_ok());
        assert!(zip_path.exists());

        // 验证ZIP文件包含所有期望的文件
        let metadata = std::fs::metadata(&zip_path).unwrap();
        assert!(metadata.len() > 0);
    }

    #[tokio::test]
    async fn test_normalize_path() {
        // 测试路径规范化函数
        assert_eq!(normalize_path("/test/path"), "test/path");
        assert_eq!(normalize_path("test/path"), "test/path");
        assert_eq!(normalize_path("/"), "");
        assert_eq!(normalize_path(""), "");
    }
}
