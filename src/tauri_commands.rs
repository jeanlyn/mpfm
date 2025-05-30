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

fn get_connection_manager() -> Result<ConnectionManager, crate::core::error::Error> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| crate::core::error::Error::new_config("无法获取配置目录"))?
        .join("mpfm");
    let config_path = config_dir.join("connections.json");
    ConnectionManager::new(config_path)
}
