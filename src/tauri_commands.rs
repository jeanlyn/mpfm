use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use tauri::command;
use opendal::Entry;
use crate::core::config::{ConnectionConfig, ConnectionManager};
use crate::core::file::FileManager;
use crate::protocols::{create_protocol};

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub id: String,
    pub name: String,
    pub protocol_type: String,
    pub config: HashMap<String, String>,
}

impl From<ConnectionConfig> for ConnectionInfo {
    fn from(config: ConnectionConfig) -> Self {
        Self {
            id: config.id,
            name: config.name,
            protocol_type: config.protocol_type,
            config: config.config,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
    pub modified: Option<String>,
}

impl From<Entry> for FileInfo {
    fn from(entry: Entry) -> Self {
        let metadata = entry.metadata();
        Self {
            name: entry.name().to_string(),
            path: entry.path().to_string(),
            is_dir: metadata.is_dir(),
            size: if metadata.is_file() { Some(metadata.content_length()) } else { None },
            modified: metadata.last_modified().map(|dt| dt.to_rfc3339()),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedFileList {
    pub files: Vec<FileInfo>,
    pub total: usize,
    pub page: usize,
    pub page_size: usize,
    pub has_more: bool,
}

#[command]
pub async fn get_connections() -> ApiResponse<Vec<ConnectionInfo>> {
    match get_connection_manager() {
        Ok(manager) => {
            let connections: Vec<ConnectionInfo> = manager.get_connections()
                .into_iter()
                .map(|config| config.clone().into())
                .collect();
            ApiResponse::success(connections)
        }
        Err(e) => ApiResponse::error(e.to_string()),
    }
}

#[command]
pub async fn add_connection(
    name: String,
    protocol_type: String,
    config: HashMap<String, String>,
) -> ApiResponse<ConnectionInfo> {
    match get_connection_manager() {
        Ok(mut manager) => {
            let connection_config = ConnectionConfig::new(name, protocol_type, config);
            let connection_info: ConnectionInfo = connection_config.clone().into();
            
            match manager.add_connection(connection_config) {
                Ok(_) => ApiResponse::success(connection_info),
                Err(e) => ApiResponse::error(e.to_string()),
            }
        }
        Err(e) => ApiResponse::error(e.to_string()),
    }
}

#[command]
pub async fn remove_connection(connection_id: String) -> ApiResponse<bool> {
    match get_connection_manager() {
        Ok(mut manager) => {
            match manager.remove_connection(&connection_id) {
                Ok(_) => ApiResponse::success(true),
                Err(e) => ApiResponse::error(e.to_string()),
            }
        }
        Err(e) => ApiResponse::error(e.to_string()),
    }
}

#[command]
pub async fn copy_connection(
    connection_id: String,
    new_name: String,
) -> ApiResponse<ConnectionInfo> {
    match get_connection_manager() {
        Ok(mut manager) => {
            // 获取原连接配置
            match manager.get_connection(&connection_id) {
                Some(original_config) => {
                    // 创建新的连接配置，复制原配置但使用新名称
                    let new_config = ConnectionConfig::new(
                        new_name,
                        original_config.protocol_type.clone(),
                        original_config.config.clone(),
                    );
                    let connection_info: ConnectionInfo = new_config.clone().into();
                    
                    match manager.add_connection(new_config) {
                        Ok(_) => ApiResponse::success(connection_info),
                        Err(e) => ApiResponse::error(e.to_string()),
                    }
                }
                None => ApiResponse::error(format!("连接 {} 不存在", connection_id)),
            }
        }
        Err(e) => ApiResponse::error(e.to_string()),
    }
}

#[command]
pub async fn check_s3_bucket_exists(
    bucket: String,
    region: String,
    endpoint: Option<String>,
    access_key: String,
    secret_key: String,
) -> ApiResponse<bool> {
    // 创建临时的 S3 配置来检查 bucket
    let mut config = HashMap::new();
    config.insert("bucket".to_string(), bucket.clone());
    config.insert("region".to_string(), region);
    config.insert("access_key".to_string(), access_key);
    config.insert("secret_key".to_string(), secret_key);
    if let Some(ep) = endpoint {
        config.insert("endpoint".to_string(), ep);
    }

    match create_protocol("s3", &config) {
        Ok(protocol) => {
            match protocol.create_operator() {
                Ok(operator) => {
                    // 尝试列出 bucket 根目录来检查是否存在
                    match operator.list("/").await {
                        Ok(_) => ApiResponse::success(true),
                        Err(e) => {
                            // 检查错误类型，如果是 bucket 不存在的错误
                            let error_msg = e.to_string().to_lowercase();
                            if error_msg.contains("nosuchbucket") || error_msg.contains("bucket") {
                                ApiResponse::success(false)
                            } else {
                                ApiResponse::error(format!("检查 bucket 失败: {}", e))
                            }
                        }
                    }
                }
                Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
            }
        }
        Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
    }
}

#[command]
pub async fn create_s3_bucket(
    bucket: String,
    region: String,
    endpoint: Option<String>,
    access_key: String,
    secret_key: String,
) -> ApiResponse<bool> {
    // 创建临时的 S3 配置来创建 bucket
    let mut config = HashMap::new();
    config.insert("bucket".to_string(), bucket.clone());
    config.insert("region".to_string(), region.clone());
    config.insert("access_key".to_string(), access_key.clone());
    config.insert("secret_key".to_string(), secret_key.clone());
    if let Some(ep) = endpoint.clone() {
        config.insert("endpoint".to_string(), ep);
    }

    match create_protocol("s3", &config) {
        Ok(protocol) => {
            match protocol.create_operator() {
                Ok(operator) => {
                    match operator.create_dir("/").await {
                        Ok(_) => ApiResponse::success(true),
                        Err(e) => ApiResponse::error(format!("无法自动创建bucket: {}", e))
                    }
                }
                Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
            }
        }
        
        Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
    }
}

// 辅助函数：通过 HTTP 直接调用 S3 API 创建 bucket
async fn create_bucket_via_http(
    bucket: &str,
    region: &str,
    endpoint: &str,
    access_key: &str,
    secret_key: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use reqwest::Client;
    use chrono::Utc;
    use sha2::{Sha256, Digest};
    use hmac::{Hmac, Mac};
    
    let client = Client::new();
    let url = if endpoint.ends_with('/') {
        format!("{}{}", endpoint, bucket)
    } else {
        format!("{}/{}", endpoint, bucket)
    };
    
    let timestamp = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
    let date = &timestamp[0..8];
    
    // 创建签名
    let mut headers = std::collections::HashMap::new();
    headers.insert("Host", url.split("://").nth(1).unwrap_or("").split('/').next().unwrap_or(""));
    headers.insert("X-Amz-Date", &timestamp);
    headers.insert("X-Amz-Content-Sha256", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    
    // 简化的签名过程（实际生产环境中需要完整的 AWS Signature V4）
    let auth_header = format!("AWS4-HMAC-SHA256 Credential={}/{}/{}/s3/aws4_request,SignedHeaders=host;x-amz-content-sha256;x-amz-date,Signature=placeholder", 
                             access_key, date, region);
    
    let response = client
        .put(&url)
        .header("Authorization", auth_header)
        .header("X-Amz-Date", timestamp)
        .header("X-Amz-Content-Sha256", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
        .send()
        .await?;
        
    if response.status().is_success() || response.status().as_u16() == 409 {
        // 成功或者 bucket 已存在
        Ok(())
    } else {
        Err(format!("HTTP 请求失败: {}", response.status()).into())
    }
}

#[command]
pub async fn list_files(connection_id: String, path: String) -> ApiResponse<Vec<FileInfo>> {
    match get_connection_manager() {
        Ok(manager) => {
            match manager.get_connection(&connection_id) {
                Some(config) => {
                    match create_protocol(&config.protocol_type, &config.config) {
                        Ok(protocol) => {
                            match protocol.create_operator() {
                                Ok(operator) => {
                                    let file_manager = FileManager::new(operator);
                                    match file_manager.list(&path).await {
                                        Ok(entries) => {
                                            let files: Vec<FileInfo> = entries
                                                .into_iter()
                                                .map(|entry| entry.into())
                                                .collect();
                                            ApiResponse::success(files)
                                        }
                                        Err(e) => ApiResponse::error(format!("列出文件失败: {}", e)),
                                    }
                                }
                                Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
                            }
                        }
                        Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
                    }
                }
                None => ApiResponse::error("Connection not found".to_string()),
            }
        }
        Err(e) => ApiResponse::error(e.to_string()),
    }
}

#[command]
pub async fn list_files_paginated(
    connection_id: String, 
    path: String, 
    page: usize, 
    page_size: usize
) -> ApiResponse<PaginatedFileList> {
    match get_connection_manager() {
        Ok(manager) => {
            match manager.get_connection(&connection_id) {
                Some(config) => {
                    match create_protocol(&config.protocol_type, &config.config) {
                        Ok(protocol) => {
                            match protocol.create_operator() {
                                Ok(operator) => {
                                    let file_manager = FileManager::new(operator);
                                    match file_manager.list_paginated(&path, page, page_size).await {
                                        Ok((entries, total)) => {
                                            let files: Vec<FileInfo> = entries
                                                .into_iter()
                                                .map(|entry| entry.into())
                                                .collect();
                                            
                                            let paginated_list = PaginatedFileList {
                                                files,
                                                total,
                                                page,
                                                page_size,
                                                has_more: (page + 1) * page_size < total,
                                            };
                                            
                                            ApiResponse::success(paginated_list)
                                        }
                                        Err(e) => ApiResponse::error(format!("分页列出文件失败: {}", e)),
                                    }
                                }
                                Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
                            }
                        }
                        Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
                    }
                }
                None => ApiResponse::error("Connection not found".to_string()),
            }
        }
        Err(e) => ApiResponse::error(e.to_string()),
    }
}

#[command]
pub async fn upload_file(
    connection_id: String,
    local_path: String,
    remote_path: String,
) -> ApiResponse<bool> {
    match get_connection_manager() {
        Ok(manager) => {
            match manager.get_connection(&connection_id) {
                Some(config) => {
                    match create_protocol(&config.protocol_type, &config.config) {
                        Ok(protocol) => {
                            match protocol.create_operator() {
                                Ok(operator) => {
                                    let file_manager = FileManager::new(operator);
                                    match file_manager.upload(&std::path::Path::new(&local_path), &remote_path).await {
                                        Ok(_) => ApiResponse::success(true),
                                        Err(e) => ApiResponse::error(format!("上传文件失败: {}", e)),
                                    }
                                }
                                Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
                            }
                        }
                        Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
                    }
                }
                None => ApiResponse::error("Connection not found".to_string()),
            }
        }
        Err(e) => ApiResponse::error(e.to_string()),
    }
}

#[command]
pub async fn download_file(
    connection_id: String,
    remote_path: String,
    local_path: String,
) -> ApiResponse<bool> {
    match get_connection_manager() {
        Ok(manager) => {
            match manager.get_connection(&connection_id) {
                Some(config) => {
                    match create_protocol(&config.protocol_type, &config.config) {
                        Ok(protocol) => {
                            match protocol.create_operator() {
                                Ok(operator) => {
                                    let file_manager = FileManager::new(operator);
                                    match file_manager.download(&remote_path, &std::path::Path::new(&local_path)).await {
                                        Ok(_) => ApiResponse::success(true),
                                        Err(e) => ApiResponse::error(format!("下载文件失败: {}", e)),
                                    }
                                }
                                Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
                            }
                        }
                        Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
                    }
                }
                None => ApiResponse::error("Connection not found".to_string()),
            }
        }
        Err(e) => ApiResponse::error(e.to_string()),
    }
}

#[command]
pub async fn delete_file(connection_id: String, path: String) -> ApiResponse<bool> {
    match get_connection_manager() {
        Ok(manager) => {
            match manager.get_connection(&connection_id) {
                Some(config) => {
                    match create_protocol(&config.protocol_type, &config.config) {
                        Ok(protocol) => {
                            match protocol.create_operator() {
                                Ok(operator) => {
                                    let file_manager = FileManager::new(operator);
                                    match file_manager.delete(&path).await {
                                        Ok(_) => ApiResponse::success(true),
                                        Err(e) => ApiResponse::error(format!("删除文件失败: {}", e)),
                                    }
                                }
                                Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
                            }
                        }
                        Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
                    }
                }
                None => ApiResponse::error("Connection not found".to_string()),
            }
        }
        Err(e) => ApiResponse::error(e.to_string()),
    }
}

#[command]
pub async fn create_directory(connection_id: String, path: String) -> ApiResponse<bool> {
    match get_connection_manager() {
        Ok(manager) => {
            match manager.get_connection(&connection_id) {
                Some(config) => {
                    match create_protocol(&config.protocol_type, &config.config) {
                        Ok(protocol) => {
                            match protocol.create_operator() {
                                Ok(operator) => {
                                    let file_manager = FileManager::new(operator);
                                    let dir_path = if path.ends_with('/') { path } else { format!("{}/", path) };
                                    match file_manager.create_dir(&dir_path).await {
                                        Ok(_) => ApiResponse::success(true),
                                        Err(e) => ApiResponse::error(format!("创建目录失败: {}", e)),
                                    }
                                }
                                Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
                            }
                        }
                        Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
                    }
                }
                None => ApiResponse::error("Connection not found".to_string()),
            }
        }
        Err(e) => ApiResponse::error(e.to_string()),
    }
}

#[command]
pub async fn get_directory_count(connection_id: String, path: String) -> ApiResponse<usize> {
    match get_connection_manager() {
        Ok(manager) => {
            match manager.get_connection(&connection_id) {
                Some(config) => {
                    match create_protocol(&config.protocol_type, &config.config) {
                        Ok(protocol) => {
                            match protocol.create_operator() {
                                Ok(operator) => {
                                    let file_manager = FileManager::new(operator);
                                    match file_manager.list(&path).await {
                                        Ok(entries) => ApiResponse::success(entries.len()),
                                        Err(e) => ApiResponse::error(format!("获取目录文件数失败: {}", e)),
                                    }
                                }
                                Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
                            }
                        }
                        Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
                    }
                }
                None => ApiResponse::error("Connection not found".to_string()),
            }
        }
        Err(e) => ApiResponse::error(e.to_string()),
    }
}

fn get_connection_manager() -> Result<ConnectionManager, crate::core::error::Error> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| crate::core::error::Error::new_config("无法获取配置目录"))?
        .join("mpfm");
    let config_path = config_dir.join("connections.json");
    ConnectionManager::new(config_path)
}
