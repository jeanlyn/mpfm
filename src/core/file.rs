use std::fs::File;
use std::io::{self, Read, Write};
use std::path::Path;

use log::{debug, info};
use opendal::{Entry, Metadata, Operator};
use serde::{Deserialize, Serialize};

use crate::core::error::{Error, Result};

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
        all_entries.sort_by(|a, b| {
            match (a.metadata().is_dir(), b.metadata().is_dir()) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name().cmp(b.name()),
            }
        });

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

    /// 异步流式列出文件（适用于超大目录）
    pub async fn list_stream(&self, path: &str, batch_size: usize) -> Result<Vec<Vec<Entry>>> {
        debug!("流式列出路径内容: {} (批次大小: {})", path, batch_size);

        let path = normalize_path(path);
        let all_entries = self.operator.list(&path).await?;

        let mut batches = Vec::new();
        for chunk in all_entries.chunks(batch_size) {
            batches.push(chunk.to_vec());
        }

        info!("已分割为 {} 个批次", batches.len());
        Ok(batches)
    }

    /// 上传文件
    pub async fn upload(&self, local_path: &Path, remote_path: &str) -> Result<()> {
        debug!("上传文件: {} -> {}", local_path.display(), remote_path);

        if !local_path.exists() {
            return Err(Error::new_not_found(&format!(
                "本地文件不存在: {}",
                local_path.display()
            )));
        }

        let remote_path = normalize_path(remote_path);

        let mut file = File::open(local_path)?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)?;

        self.operator.write(&remote_path, buffer).await?;

        info!("文件上传成功: {} -> {}", local_path.display(), remote_path);
        Ok(())
    }

    /// 上传带进度的大文件
    pub async fn upload_with_progress<F>(
        &self,
        local_path: &Path,
        remote_path: &str,
        mut progress_callback: F,
    ) -> Result<()>
    where
        F: FnMut(u64, u64) + Send + Sync,
    {
        debug!("上传大文件: {} -> {}", local_path.display(), remote_path);

        if !local_path.exists() {
            return Err(Error::new_not_found(&format!(
                "本地文件不存在: {}",
                local_path.display()
            )));
        }

        let remote_path = normalize_path(remote_path);

        let file = File::open(local_path)?;
        let metadata = file.metadata()?;
        let total_size = metadata.len();

        let mut reader = io::BufReader::new(file);
        let mut buffer = Vec::with_capacity(total_size as usize);
        let mut chunk = [0; 1024 * 1024]; // 1MB 缓冲区
        let mut uploaded = 0;

        loop {
            let n = reader.read(&mut chunk)?;
            if n == 0 {
                break;
            }

            buffer.extend_from_slice(&chunk[..n]);
            uploaded += n as u64;
            progress_callback(uploaded, total_size);
        }

        self.operator.write(&remote_path, buffer).await?;

        info!("大文件上传成功: {} -> {}", local_path.display(), remote_path);
        Ok(())
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

        info!("大文件下载成功: {} -> {}", remote_path, local_path.display());
        Ok(())
    }

    /// 删除文件
    pub async fn delete(&self, path: &str) -> Result<()> {
        debug!("删除文件: {}", path);

        let path = normalize_path(path);
        self.operator.delete(&path).await?;

        info!("文件删除成功: {}", path);
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

    /// 搜索文件和目录（支持模糊匹配文件名）
    pub async fn search(&self, path: &str, query: &str) -> Result<Vec<Entry>> {
        debug!("搜索文件: 路径={}, 查询={}", path, query);

        let path = normalize_path(path);

        // 获取目录列表
        let all_entries = self.operator.list(&path).await?;

        // 过滤匹配查询的文件
        let query_lower = query.to_lowercase();
        let filtered_entries: Vec<Entry> = all_entries
            .into_iter()
            .filter(|entry| entry.name().to_lowercase().contains(&query_lower))
            .collect();

        info!("搜索到 {} 个匹配的文件/目录", filtered_entries.len());
        Ok(filtered_entries)
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
        filtered_entries.sort_by(|a, b| {
            match (a.metadata().is_dir(), b.metadata().is_dir()) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name().cmp(b.name()),
            }
        });

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
            name: path.split('/').last().unwrap_or(&path).to_string(),
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