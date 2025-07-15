use crate::core::config::ConnectionConfig;
use crate::protocols::create_protocol;
use std::collections::HashMap;
use tauri::command;

use super::types::{ApiResponse, ConnectionInfo};
use super::utils::get_connection_manager;

#[command]
pub async fn get_connections() -> ApiResponse<Vec<ConnectionInfo>> {
    match get_connection_manager() {
        Ok(manager) => {
            let connections: Vec<ConnectionInfo> = manager
                .get_connections()
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
        Ok(mut manager) => match manager.remove_connection(&connection_id) {
            Ok(_) => ApiResponse::success(true),
            Err(e) => ApiResponse::error(e.to_string()),
        },
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
pub async fn update_connection(
    connection_id: String,
    name: String,
    protocol_type: String,
    config: HashMap<String, String>,
) -> ApiResponse<ConnectionInfo> {
    match get_connection_manager() {
        Ok(mut manager) => {
            match manager.update_connection(&connection_id, name, protocol_type, config) {
                Ok(_) => {
                    // 返回更新后的连接信息
                    match manager.get_connection(&connection_id) {
                        Some(updated_config) => {
                            let connection_info: ConnectionInfo = updated_config.clone().into();
                            ApiResponse::success(connection_info)
                        }
                        None => ApiResponse::error("更新后无法找到连接".to_string()),
                    }
                }
                Err(e) => ApiResponse::error(e.to_string()),
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
        Ok(protocol) => match protocol.create_operator() {
            Ok(operator) => match operator.create_dir("/").await {
                Ok(_) => ApiResponse::success(true),
                Err(e) => ApiResponse::error(format!("无法自动创建bucket: {}", e)),
            },
            Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
        },
        Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
    }
}
