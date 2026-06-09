use std::collections::{BTreeMap, HashMap};

use crate::core::file::FileManager;
use crate::core::{Error, Result};
use crate::protocols::create_protocol;
use tauri::command;
use tauri_plugin_clipboard_manager::ClipboardExt;

use super::types::{ApiResponse, FileInfo, PaginatedFileList};
use super::utils::get_connection_manager;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum CliShell {
    Bash,
    PowerShell,
}

impl CliShell {
    fn from_target(target_shell: &str) -> Result<Self> {
        match target_shell {
            "bash" => Ok(Self::Bash),
            "powershell" => Ok(Self::PowerShell),
            other => Err(Error::new_config(&format!("不支持的目标 shell: {}", other))),
        }
    }
}

fn shell_escape(value: &str, shell: CliShell) -> String {
    match shell {
        CliShell::Bash => format!("'{}'", value.replace('\'', "'\\''")),
        CliShell::PowerShell => format!("'{}'", value.replace('\'', "''")),
    }
}

fn build_download_cli_command(
    binary_name: &str,
    protocol_type: &str,
    config: &HashMap<String, String>,
    remote_path: &str,
    local_path: &str,
    shell: CliShell,
) -> Result<String> {
    let ordered_config: BTreeMap<String, String> = config
        .iter()
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect();

    let config_json = serde_json::to_string(&ordered_config)
        .map_err(|e| Error::new_config(&format!("序列化连接配置失败: {}", e)))?;

    Ok(format!(
        "{} download --type {} --config {} {} {}",
        binary_name,
        shell_escape(protocol_type, shell),
        shell_escape(&config_json, shell),
        shell_escape(remote_path, shell),
        shell_escape(local_path, shell)
    ))
}

fn default_download_target(remote_path: &str) -> String {
    let file_name = remote_path
        .split('/')
        .rfind(|part| !part.is_empty())
        .unwrap_or("downloaded-file");

    format!("./{}", file_name)
}

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
                            .upload(std::path::Path::new(&local_path), &remote_path)
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
pub async fn upload_directory(
    connection_id: String,
    local_dir_path: String,
    remote_base_path: String,
) -> ApiResponse<usize> {
    match get_connection_manager() {
        Ok(manager) => match manager.get_connection(&connection_id) {
            Some(config) => match create_protocol(&config.protocol_type, &config.config) {
                Ok(protocol) => match protocol.create_operator() {
                    Ok(operator) => {
                        let file_manager = FileManager::new(operator);
                        match file_manager
                            .upload_directory(
                                std::path::Path::new(&local_dir_path),
                                &remote_base_path,
                            )
                            .await
                        {
                            Ok(count) => ApiResponse::success(count),
                            Err(e) => ApiResponse::error(format!("上传目录失败: {}", e)),
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
                            .download(&remote_path, std::path::Path::new(&local_path))
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
pub async fn build_download_command(
    connection_id: String,
    remote_path: String,
    target_shell: String,
) -> ApiResponse<String> {
    match get_connection_manager() {
        Ok(manager) => match manager.get_connection(&connection_id) {
            Some(config) => match CliShell::from_target(&target_shell) {
                Ok(shell) => match build_download_cli_command(
                    "main_cli",
                    &config.protocol_type,
                    &config.config,
                    &remote_path,
                    &default_download_target(&remote_path),
                    shell,
                ) {
                    Ok(command) => ApiResponse::success(command),
                    Err(e) => ApiResponse::error(format!("生成下载命令失败: {}", e)),
                },
                Err(e) => ApiResponse::error(format!("生成下载命令失败: {}", e)),
            },
            None => ApiResponse::error("Connection not found".to_string()),
        },
        Err(e) => ApiResponse::error(e.to_string()),
    }
}

#[command]
pub fn copy_text_to_clipboard(app: tauri::AppHandle, text: String) -> ApiResponse<bool> {
    match app.clipboard().write_text(text) {
        Ok(_) => ApiResponse::success(true),
        Err(e) => ApiResponse::error(format!("复制到剪贴板失败: {}", e)),
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

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::{build_download_cli_command, CliShell};

    #[test]
    fn builds_bash_download_command_with_inline_protocol_config() {
        let mut config = HashMap::new();
        config.insert("host".to_string(), "ftp.example.com".to_string());
        config.insert("port".to_string(), "21".to_string());
        config.insert("username".to_string(), "demo".to_string());
        config.insert("password".to_string(), "secret".to_string());

        let command = build_download_cli_command(
            "main_cli",
            "ftp",
            &config,
            "/packages/app.tar.gz",
            "./app.tar.gz",
            CliShell::Bash,
        )
        .unwrap();

        assert_eq!(
            command,
            r#"main_cli download --type 'ftp' --config '{"host":"ftp.example.com","password":"secret","port":"21","username":"demo"}' '/packages/app.tar.gz' './app.tar.gz'"#
        );
    }

    #[test]
    fn builds_powershell_download_command_with_escaped_quotes() {
        let mut config = HashMap::new();
        config.insert("bucket".to_string(), "team's-bucket".to_string());
        config.insert("region".to_string(), "us-east-1".to_string());
        config.insert("access_key".to_string(), "AKIA123".to_string());
        config.insert("secret_key".to_string(), "secret".to_string());

        let command = build_download_cli_command(
            "main_cli",
            "s3",
            &config,
            "/release packages/app's build.tar.gz",
            "./app's build.tar.gz",
            CliShell::PowerShell,
        )
        .unwrap();

        assert_eq!(
            command,
            "main_cli download --type 's3' --config '{\"access_key\":\"AKIA123\",\"bucket\":\"team''s-bucket\",\"region\":\"us-east-1\",\"secret_key\":\"secret\"}' '/release packages/app''s build.tar.gz' './app''s build.tar.gz'"
        );
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

#[command]
pub async fn batch_download_files(
    connection_id: String,
    file_paths: Vec<String>,
    save_path: String,
) -> ApiResponse<bool> {
    match get_connection_manager() {
        Ok(manager) => match manager.get_connection(&connection_id) {
            Some(config) => match create_protocol(&config.protocol_type, &config.config) {
                Ok(protocol) => match protocol.create_operator() {
                    Ok(operator) => {
                        let file_manager = FileManager::new(operator);
                        match file_manager
                            .batch_download_as_zip(&file_paths, &save_path)
                            .await
                        {
                            Ok(_) => ApiResponse::success(true),
                            Err(e) => ApiResponse::error(format!("批量下载失败: {}", e)),
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
