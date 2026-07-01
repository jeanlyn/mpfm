use std::collections::HashMap;

use crate::core::config::ConnectionConfig;
use crate::protocols::create_protocol;
use tauri::command;

use super::types::{ApiResponse, ConnectionInfo};
use super::utils::{
    list_connection_configs, reload_connection_configs, with_connection_manager_mut,
};

#[command]
pub async fn get_connections() -> ApiResponse<Vec<ConnectionInfo>> {
    match list_connection_configs() {
        Ok(configs) => {
            let connections: Vec<ConnectionInfo> =
                configs.into_iter().map(|config| config.into()).collect();
            ApiResponse::success(connections)
        }
        Err(e) => ApiResponse::error(e),
    }
}

#[command]
pub async fn reload_connections() -> ApiResponse<Vec<ConnectionInfo>> {
    match reload_connection_configs() {
        Ok(configs) => {
            let connections: Vec<ConnectionInfo> =
                configs.into_iter().map(|config| config.into()).collect();
            ApiResponse::success(connections)
        }
        Err(e) => ApiResponse::error(e),
    }
}

#[command]
pub async fn add_connection(
    name: String,
    protocol_type: String,
    config: HashMap<String, String>,
) -> ApiResponse<ConnectionInfo> {
    match with_connection_manager_mut(|manager| {
        let connection_config = ConnectionConfig::new(name, protocol_type, config);
        let connection_info: ConnectionInfo = connection_config.clone().into();
        manager
            .add_connection(connection_config)
            .map_err(|e| e.to_string())?;
        Ok(connection_info)
    }) {
        Ok(connection_info) => ApiResponse::success(connection_info),
        Err(e) => ApiResponse::error(e),
    }
}

#[command]
pub async fn remove_connection(connection_id: String) -> ApiResponse<bool> {
    match with_connection_manager_mut(|manager| {
        manager
            .remove_connection(&connection_id)
            .map_err(|e| e.to_string())?;
        Ok(true)
    }) {
        Ok(result) => ApiResponse::success(result),
        Err(e) => ApiResponse::error(e),
    }
}

#[command]
pub async fn copy_connection(
    connection_id: String,
    new_name: String,
) -> ApiResponse<ConnectionInfo> {
    match with_connection_manager_mut(|manager| {
        let original_config = manager
            .get_connection(&connection_id)
            .ok_or_else(|| format!("连接 {} 不存在", connection_id))?;
        let new_config = ConnectionConfig::new(
            new_name,
            original_config.protocol_type.clone(),
            original_config.config.clone(),
        );
        let connection_info: ConnectionInfo = new_config.clone().into();
        manager
            .add_connection(new_config)
            .map_err(|e| e.to_string())?;
        Ok(connection_info)
    }) {
        Ok(connection_info) => ApiResponse::success(connection_info),
        Err(e) => ApiResponse::error(e),
    }
}

#[command]
pub async fn update_connection(
    connection_id: String,
    name: String,
    protocol_type: String,
    config: HashMap<String, String>,
) -> ApiResponse<ConnectionInfo> {
    match with_connection_manager_mut(|manager| {
        manager
            .update_connection(&connection_id, name, protocol_type, config)
            .map_err(|e| e.to_string())?;
        let updated_config = manager
            .get_connection(&connection_id)
            .ok_or_else(|| "更新后无法找到连接".to_string())?;
        Ok(ConnectionInfo::from(updated_config.clone()))
    }) {
        Ok(connection_info) => ApiResponse::success(connection_info),
        Err(e) => ApiResponse::error(e),
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
    let mut config = HashMap::new();
    config.insert("bucket".to_string(), bucket.clone());
    config.insert("region".to_string(), region);
    config.insert("access_key".to_string(), access_key);
    config.insert("secret_key".to_string(), secret_key);
    if let Some(ep) = endpoint {
        config.insert("endpoint".to_string(), ep);
    }

    match create_protocol("s3", &config) {
        Ok(protocol) => match protocol.create_operator() {
            Ok(operator) => match operator.list("/").await {
                Ok(_) => ApiResponse::success(true),
                Err(e) => {
                    let error_msg = e.to_string().to_lowercase();
                    if error_msg.contains("nosuchbucket") || error_msg.contains("bucket") {
                        ApiResponse::success(false)
                    } else {
                        ApiResponse::error(format!("检查 bucket 失败: {}", e))
                    }
                }
            },
            Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
        },
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

#[command]
pub async fn list_s3_buckets(
    region: String,
    endpoint: Option<String>,
    access_key: String,
    secret_key: String,
) -> ApiResponse<Vec<String>> {
    match crate::utils::s3_list_buckets::list_s3_buckets(
        &region,
        endpoint.as_deref(),
        &access_key,
        &secret_key,
    )
    .await
    {
        Ok(buckets) => ApiResponse::success(buckets),
        Err(e) => ApiResponse::error(e),
    }
}
