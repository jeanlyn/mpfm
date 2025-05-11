use std::path::Path;
use std::fs::File;
use std::io::{self, Read, Write};

use log::{debug, info};
use opendal::{Operator, Entry, Metadata};

use crate::core::error::{Error, Result};

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
        
        // 直接使用 list 方法
        let entries = match self.operator.list(&path).await {
            Ok(entries) => entries,
            Err(e) => return Err(Error::from(e)),
        };
        
        info!("已列出 {} 个文件/目录", entries.len());
        Ok(entries)
    }
    
    /// 上传文件
    pub async fn upload(&self, local_path: &Path, remote_path: &str) -> Result<()> {
        debug!("上传文件: {} -> {}", local_path.display(), remote_path);
        
        if !local_path.exists() {
            return Err(Error::new_not_found(&format!(
                "本地文件不存在: {}", local_path.display()
            )));
        }
        
        let remote_path = normalize_path(remote_path);
        
        let mut file = File::open(local_path)
            .map_err(|e| Error::new_io(&format!("无法打开本地文件: {}", e)))?;
        
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)
            .map_err(|e| Error::new_io(&format!("读取本地文件失败: {}", e)))?;
        
        self.operator.write(&remote_path, buffer).await?;
        
        info!("文件上传成功: {} -> {}", local_path.display(), remote_path);
        Ok(())
    }
    
    /// 上传带进度的大文件
    pub async fn upload_with_progress<F>(&self, local_path: &Path, remote_path: &str, progress_callback: F) -> Result<()>
    where
        F: Fn(u64, u64) + Send + Sync,
    {
        debug!("上传大文件: {} -> {}", local_path.display(), remote_path);
        
        if !local_path.exists() {
            return Err(Error::new_not_found(&format!(
                "本地文件不存在: {}", local_path.display()
            )));
        }
        
        let remote_path = normalize_path(remote_path);
        
        let file = File::open(local_path)
            .map_err(|e| Error::new_io(&format!("无法打开本地文件: {}", e)))?;
        
        let metadata = file.metadata()
            .map_err(|e| Error::new_io(&format!("无法获取文件元数据: {}", e)))?;
        
        let total_size = metadata.len();
        let mut reader = io::BufReader::new(file);
        
        // 读取文件内容
        let mut buffer = Vec::with_capacity(total_size as usize);
        let mut chunk = [0; 1024 * 1024]; // 1MB 缓冲区
        let mut uploaded = 0;
        
        loop {
            let n = reader.read(&mut chunk)
                .map_err(|e| Error::new_io(&format!("读取本地文件失败: {}", e)))?;
            
            if n == 0 {
                break;
            }
            
            buffer.extend_from_slice(&chunk[..n]);
            uploaded += n as u64;
            progress_callback(uploaded, total_size);
        }
        
        // 写入远程文件
        self.operator.write(&remote_path, buffer).await?;
        
        info!("大文件上传成功: {} -> {}", local_path.display(), remote_path);
        Ok(())
    }
    
    /// 下载文件
    pub async fn download(&self, remote_path: &str, local_path: &Path) -> Result<()> {
        debug!("下载文件: {} -> {}", remote_path, local_path.display());
        
        let remote_path = normalize_path(remote_path);
        
        // 检查远程文件是否存在
        if !self.operator.is_exist(&remote_path).await? {
            return Err(Error::new_not_found(&format!(
                "远程文件不存在: {}", remote_path
            )));
        }
        
        // 创建本地目录（如果需要）
        if let Some(parent) = local_path.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| Error::new_io(&format!("无法创建本地目录: {}", e)))?;
            }
        }
        
        let data = self.operator.read(&remote_path).await?;
        
        let mut file = File::create(local_path)
            .map_err(|e| Error::new_io(&format!("无法创建本地文件: {}", e)))?;
        
        file.write_all(&data)
            .map_err(|e| Error::new_io(&format!("写入本地文件失败: {}", e)))?;
        
        info!("文件下载成功: {} -> {}", remote_path, local_path.display());
        Ok(())
    }
    
    /// 下载带进度的大文件
    pub async fn download_with_progress<F>(&self, remote_path: &str, local_path: &Path, progress_callback: F) -> Result<()>
    where
        F: Fn(u64, u64) + Send + Sync,
    {
        debug!("下载大文件: {} -> {}", remote_path, local_path.display());
        
        let remote_path = normalize_path(remote_path);
        
        // 检查远程文件是否存在并获取文件大小
        let metadata = self.operator.stat(&remote_path).await?;
        let total_size = metadata.content_length();
        
        // 创建本地目录（如果需要）
        if let Some(parent) = local_path.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| Error::new_io(&format!("无法创建本地目录: {}", e)))?;
            }
        }
        
        // 直接读取全部数据
        let data = self.operator.read(&remote_path).await?;
        progress_callback(data.len() as u64, total_size);
        
        let mut file = File::create(local_path)
            .map_err(|e| Error::new_io(&format!("无法创建本地文件: {}", e)))?;
        
        file.write_all(&data)
            .map_err(|e| Error::new_io(&format!("写入本地文件失败: {}", e)))?;
        
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
        
        debug!("获取到元数据: 大小={}, 最后修改时间={:?}", 
               meta.content_length(), meta.last_modified());
        
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
}

/// 规范化路径，处理开头和结尾的斜杠
fn normalize_path(path: &str) -> String {
    let mut path = path.to_string();
    
    // 移除开头的斜杠，OpenDAL 默认不需要
    if path.starts_with('/') {
        path.remove(0);
    }
    
    path
}