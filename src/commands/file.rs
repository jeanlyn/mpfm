use crate::core::file::FileManager;
use crate::protocols::create_protocol;
use tauri::command;

use super::types::{ApiResponse, FileInfo, PaginatedFileList};
use super::utils::get_connection_manager;

#[command]
pub async fn list_files(connection_id: String, path: String) -> ApiResponse<Vec<FileInfo>> {
    match get_connection_manager() {
        Ok(manager) => match manager.get_connection(&connection_id) {
            Some(config) => match create_protocol(&config.protocol_type, &config.config) {
                Ok(protocol) => match protocol.create_operator() {
                    Ok(operator) => {
                        let file_manager = FileManager::new(operator);
                        match file_manager.list(&path).await {
                            Ok(entries) => {
                                let files: Vec<FileInfo> =
                                    entries.into_iter().map(|entry| entry.into()).collect();
                                ApiResponse::success(files)
                            }
                            Err(e) => ApiResponse::error(format!("列出文件失败: {}", e)),
                        }
                    }
                    Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
                },
                Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
            },
            None => ApiResponse::error("Connection not found".to_string()),
        },
        Err(e) => ApiResponse::error(e.to_string()),
    }
}

#[command]
pub async fn list_files_paginated(
    connection_id: String,
    path: String,
    page: usize,
    page_size: usize,
) -> ApiResponse<PaginatedFileList> {
    match get_connection_manager() {
        Ok(manager) => match manager.get_connection(&connection_id) {
            Some(config) => match create_protocol(&config.protocol_type, &config.config) {
                Ok(protocol) => match protocol.create_operator() {
                    Ok(operator) => {
                        let file_manager = FileManager::new(operator);
                        match file_manager.list_paginated(&path, page, page_size).await {
                            Ok((entries, total)) => {
                                let files: Vec<FileInfo> =
                                    entries.into_iter().map(|entry| entry.into()).collect();

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
                },
                Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
            },
            None => ApiResponse::error("Connection not found".to_string()),
        },
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
        Ok(manager) => match manager.get_connection(&connection_id) {
            Some(config) => match create_protocol(&config.protocol_type, &config.config) {
                Ok(protocol) => match protocol.create_operator() {
                    Ok(operator) => {
                        let file_manager = FileManager::new(operator);
                        match file_manager
                            .upload(&std::path::Path::new(&local_path), &remote_path)
                            .await
                        {
                            Ok(_) => ApiResponse::success(true),
                            Err(e) => ApiResponse::error(format!("上传文件失败: {}", e)),
                        }
                    }
                    Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
                },
                Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
            },
            None => ApiResponse::error("Connection not found".to_string()),
        },
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
        Ok(manager) => match manager.get_connection(&connection_id) {
            Some(config) => match create_protocol(&config.protocol_type, &config.config) {
                Ok(protocol) => match protocol.create_operator() {
                    Ok(operator) => {
                        let file_manager = FileManager::new(operator);
                        match file_manager
                            .download(&remote_path, &std::path::Path::new(&local_path))
                            .await
                        {
                            Ok(_) => ApiResponse::success(true),
                            Err(e) => ApiResponse::error(format!("下载文件失败: {}", e)),
                        }
                    }
                    Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
                },
                Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
            },
            None => ApiResponse::error("Connection not found".to_string()),
        },
        Err(e) => ApiResponse::error(e.to_string()),
    }
}

#[command]
pub async fn delete_file(connection_id: String, path: String) -> ApiResponse<bool> {
    match get_connection_manager() {
        Ok(manager) => match manager.get_connection(&connection_id) {
            Some(config) => match create_protocol(&config.protocol_type, &config.config) {
                Ok(protocol) => match protocol.create_operator() {
                    Ok(operator) => {
                        let file_manager = FileManager::new(operator);
                        match file_manager.delete(&path).await {
                            Ok(_) => ApiResponse::success(true),
                            Err(e) => ApiResponse::error(format!("删除文件失败: {}", e)),
                        }
                    }
                    Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
                },
                Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
            },
            None => ApiResponse::error("Connection not found".to_string()),
        },
        Err(e) => ApiResponse::error(e.to_string()),
    }
}

#[command]
pub async fn create_directory(connection_id: String, path: String) -> ApiResponse<bool> {
    match get_connection_manager() {
        Ok(manager) => match manager.get_connection(&connection_id) {
            Some(config) => match create_protocol(&config.protocol_type, &config.config) {
                Ok(protocol) => match protocol.create_operator() {
                    Ok(operator) => {
                        let file_manager = FileManager::new(operator);
                        let dir_path = if path.ends_with('/') {
                            path
                        } else {
                            format!("{}/", path)
                        };
                        match file_manager.create_dir(&dir_path).await {
                            Ok(_) => ApiResponse::success(true),
                            Err(e) => ApiResponse::error(format!("创建目录失败: {}", e)),
                        }
                    }
                    Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
                },
                Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
            },
            None => ApiResponse::error("Connection not found".to_string()),
        },
        Err(e) => ApiResponse::error(e.to_string()),
    }
}

#[command]
pub async fn get_directory_count(connection_id: String, path: String) -> ApiResponse<usize> {
    match get_connection_manager() {
        Ok(manager) => match manager.get_connection(&connection_id) {
            Some(config) => match create_protocol(&config.protocol_type, &config.config) {
                Ok(protocol) => match protocol.create_operator() {
                    Ok(operator) => {
                        let file_manager = FileManager::new(operator);
                        match file_manager.list(&path).await {
                            Ok(entries) => ApiResponse::success(entries.len()),
                            Err(e) => ApiResponse::error(format!("获取目录文件数失败: {}", e)),
                        }
                    }
                    Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
                },
                Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
            },
            None => ApiResponse::error("Connection not found".to_string()),
        },
        Err(e) => ApiResponse::error(e.to_string()),
    }
}

#[command]
pub async fn search_files(
    connection_id: String,
    path: String,
    query: String,
    page: usize,
    page_size: usize,
) -> ApiResponse<PaginatedFileList> {
    match get_connection_manager() {
        Ok(manager) => match manager.get_connection(&connection_id) {
            Some(config) => match create_protocol(&config.protocol_type, &config.config) {
                Ok(protocol) => match protocol.create_operator() {
                    Ok(operator) => {
                        let file_manager = FileManager::new(operator);
                        match file_manager
                            .search_paginated(&path, &query, page, page_size)
                            .await
                        {
                            Ok((entries, total)) => {
                                let files: Vec<FileInfo> =
                                    entries.into_iter().map(|entry| entry.into()).collect();

                                let paginated_list = PaginatedFileList {
                                    files,
                                    total,
                                    page,
                                    page_size,
                                    has_more: (page + 1) * page_size < total,
                                };

                                ApiResponse::success(paginated_list)
                            }
                            Err(e) => ApiResponse::error(format!("搜索文件失败: {}", e)),
                        }
                    }
                    Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
                },
                Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
            },
            None => ApiResponse::error("Connection not found".to_string()),
        },
        Err(e) => ApiResponse::error(e.to_string()),
    }
}

#[command]
pub async fn get_file_content(
    connection_id: String,
    path: String,
    r#type: String, // 使用 r#type 因为 type 是 Rust 关键字
) -> ApiResponse<serde_json::Value> {
    match get_connection_manager() {
        Ok(manager) => {
            match manager.get_connection(&connection_id) {
                Some(config) => {
                    match create_protocol(&config.protocol_type, &config.config) {
                        Ok(protocol) => {
                            match protocol.create_operator() {
                                Ok(operator) => {
                                    let file_manager = FileManager::new(operator);

                                    // 检查文件大小限制（5MB）
                                    match file_manager.get_file_info(&path).await {
                                        Ok(Some(info)) => {
                                            if let Some(size) = info.size {
                                                if size > 5 * 1024 * 1024 {
                                                    return ApiResponse::error(
                                                        "文件太大，无法预览（限制5MB）".to_string(),
                                                    );
                                                }
                                            }
                                        }
                                        Ok(None) => {
                                            return ApiResponse::error("文件不存在".to_string());
                                        }
                                        Err(e) => {
                                            return ApiResponse::error(format!(
                                                "获取文件信息失败: {}",
                                                e
                                            ));
                                        }
                                    }

                                    match file_manager.read_file(&path).await {
                                        Ok(content) => {
                                            let bytes = content.to_bytes().to_vec();

                                            if r#type == "binary" {
                                                // 对于二进制文件，返回字节数组
                                                ApiResponse::success(serde_json::Value::Array(
                                                    bytes
                                                        .into_iter()
                                                        .map(|b| {
                                                            serde_json::Value::Number(b.into())
                                                        })
                                                        .collect(),
                                                ))
                                            } else {
                                                // 对于文本文件，尝试转换为 UTF-8 字符串
                                                match String::from_utf8(bytes) {
                                                    Ok(text) => ApiResponse::success(
                                                        serde_json::Value::String(text),
                                                    ),
                                                    Err(_) => {
                                                        // 如果不是有效的UTF-8，尝试其他编码或返回错误
                                                        ApiResponse::error("文件不是有效的UTF-8格式，请尝试二进制预览".to_string())
                                                    }
                                                }
                                            }
                                        }
                                        Err(e) => {
                                            ApiResponse::error(format!("读取文件失败: {}", e))
                                        }
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
