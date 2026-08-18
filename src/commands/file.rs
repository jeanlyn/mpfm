use std::collections::{BTreeMap, HashMap};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use log::{debug, warn};
use opendal::Operator;

use crate::core::file::{copy_remote_file_between_operators, FileManager};
use crate::core::{Error, Result};
use crate::protocols::create_protocol;
use serde::Serialize;
use tauri::command;
use tauri::{AppHandle, Emitter};
use tauri_plugin_clipboard_manager::ClipboardExt;

use super::types::{ApiResponse, FileInfo, PaginatedFileList};
use super::utils::get_connection_config;

const UPLOAD_PROGRESS_EVENT: &str = "upload-progress";

/// 全局上传取消令牌表：uploadId -> 取消标志。
/// 上传开始时注册，上传结束（成功/失败/取消）后移除。
/// `cancel_upload` 命令据此置位以中断对应上传。
static UPLOAD_CANCEL_TOKENS: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();

fn cancel_tokens() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    UPLOAD_CANCEL_TOKENS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// 注册一次上传的取消令牌，返回其克隆供上传循环检查。
/// 上传结束后应调用 `remove_upload_cancel_token` 清理。
fn register_upload_cancel_token(upload_id: &str) -> Arc<AtomicBool> {
    let flag = Arc::new(AtomicBool::new(false));
    if let Ok(mut tokens) = cancel_tokens().lock() {
        tokens.insert(upload_id.to_string(), flag.clone());
    }
    flag
}

/// 置位指定上传的取消标志；返回是否找到该上传。
fn set_upload_cancelled(upload_id: &str) -> bool {
    if let Ok(tokens) = cancel_tokens().lock() {
        if let Some(flag) = tokens.get(upload_id) {
            flag.store(true, Ordering::Relaxed);
            return true;
        }
    }
    false
}

/// 移除指定上传的取消令牌。
fn remove_upload_cancel_token(upload_id: &str) {
    if let Ok(mut tokens) = cancel_tokens().lock() {
        tokens.remove(upload_id);
    }
}

/// 上传 ID 自增计数器，配合时间戳保证全局唯一
static UPLOAD_ID_COUNTER: AtomicU64 = AtomicU64::new(0);

/// 生成一个唯一的上传 ID（时间戳 + 自增计数）
fn generate_upload_id() -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let n = UPLOAD_ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("upload_{}_{}", ts, n)
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UploadProgressPayload {
    transferred: u64,
    total: u64,
    file_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    file_index: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    file_count: Option<usize>,
    completed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    /// 目录上传汇总：成功文件数（仅完成事件携带）
    #[serde(skip_serializing_if = "Option::is_none")]
    uploaded_count: Option<usize>,
    /// 目录上传汇总：失败文件数（仅完成事件携带）
    #[serde(skip_serializing_if = "Option::is_none")]
    failed_count: Option<usize>,
    /// 当前上传的唯一 ID，前端用于发起取消
    #[serde(skip_serializing_if = "Option::is_none")]
    upload_id: Option<String>,
    /// 是否已被用户取消（完成事件携带）
    #[serde(skip_serializing_if = "Option::is_none")]
    cancelled: Option<bool>,
}

fn emit_upload_progress(app: &AppHandle, payload: UploadProgressPayload) {
    let _ = app.emit(UPLOAD_PROGRESS_EVENT, payload);
}

fn maybe_emit_upload_progress(enabled: bool, app: &AppHandle, payload: UploadProgressPayload) {
    if enabled {
        emit_upload_progress(app, payload);
    }
}

/// 取消指定上传。置位取消标志后，上传循环在下一个分块检查点中止上传。
#[command]
pub async fn cancel_upload(upload_id: String) -> ApiResponse<bool> {
    let found = set_upload_cancelled(&upload_id);
    if found {
        ApiResponse::success(true)
    } else {
        ApiResponse::error(format!("未找到进行中的上传: {}", upload_id))
    }
}

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

fn url_encode_segment(segment: &str) -> String {
    let mut encoded = String::new();
    for byte in segment.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            _ => {
                encoded.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    encoded
}

fn url_encode_path(path: &str) -> String {
    if path == "/" {
        return "/".to_string();
    }

    let leading_slash = path.starts_with('/');
    let encoded = path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .map(url_encode_segment)
        .collect::<Vec<_>>()
        .join("/");

    if leading_slash {
        format!("/{}", encoded)
    } else {
        encoded
    }
}

fn join_ftp_path(root: Option<&str>, remote_path: &str) -> String {
    let remote = remote_path.trim().trim_start_matches('/');

    match root.map(str::trim).filter(|value| !value.is_empty()) {
        None | Some("/") => {
            if remote.is_empty() {
                "/".to_string()
            } else {
                format!("/{}", remote)
            }
        }
        Some(root) => {
            let root = root.trim_end_matches('/');
            if remote.is_empty() {
                root.to_string()
            } else {
                format!("{}/{}", root, remote)
            }
        }
    }
}

fn build_s3_download_url(config: &HashMap<String, String>, remote_path: &str) -> Result<String> {
    let bucket = config
        .get("bucket")
        .ok_or_else(|| Error::new_config("S3配置缺少 'bucket' 参数"))?;
    let region = config
        .get("region")
        .ok_or_else(|| Error::new_config("S3配置缺少 'region' 参数"))?;
    let key = url_encode_path(remote_path.trim_start_matches('/'));
    let path_style = config
        .get("path_style")
        .map(|value| value.to_lowercase() == "true")
        .unwrap_or(false);

    if let Some(endpoint) = config
        .get("endpoint")
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        let endpoint = endpoint.trim_end_matches('/');
        Ok(format!("{}/{}/{}", endpoint, bucket, key))
    } else if path_style {
        Ok(format!(
            "https://s3.{}.amazonaws.com/{}/{}",
            region, bucket, key
        ))
    } else {
        Ok(format!(
            "https://{}.s3.{}.amazonaws.com/{}",
            bucket, region, key
        ))
    }
}

fn format_download_curl_command(
    protocol_type: &str,
    config: &HashMap<String, String>,
    remote_path: &str,
    local_path: &str,
) -> Result<String> {
    match protocol_type {
        "s3" => {
            let access_key = config
                .get("access_key")
                .ok_or_else(|| Error::new_config("S3配置缺少 'access_key' 参数"))?;
            let secret_key = config
                .get("secret_key")
                .ok_or_else(|| Error::new_config("S3配置缺少 'secret_key' 参数"))?;
            let region = config
                .get("region")
                .ok_or_else(|| Error::new_config("S3配置缺少 'region' 参数"))?;
            let url = build_s3_download_url(config, remote_path)?;

            Ok(format!(
                "curl -L {} --aws-sigv4 'aws:amz:{}:s3' --user {} -o {}",
                shell_escape(&url, CliShell::Bash),
                region,
                shell_escape(&format!("{}:{}", access_key, secret_key), CliShell::Bash),
                shell_escape(local_path, CliShell::Bash),
            ))
        }
        "ftp" => {
            let host = config
                .get("host")
                .ok_or_else(|| Error::new_config("FTP配置缺少 'host' 参数"))?;
            let port = config
                .get("port")
                .cloned()
                .unwrap_or_else(|| "21".to_string());
            let username = config
                .get("username")
                .ok_or_else(|| Error::new_config("FTP配置缺少 'username' 参数"))?;
            let password = config
                .get("password")
                .ok_or_else(|| Error::new_config("FTP配置缺少 'password' 参数"))?;
            let secure = config
                .get("secure")
                .map(|value| value.to_lowercase() == "true")
                .unwrap_or(false);
            let root = config
                .get("root_dir")
                .or_else(|| config.get("root"))
                .map(String::as_str);
            let full_path = join_ftp_path(root, remote_path);
            let scheme = if secure { "ftps" } else { "ftp" };
            let url = format!(
                "{}://{}:{}{}",
                scheme,
                host,
                port,
                url_encode_path(&full_path)
            );

            Ok(format!(
                "curl -L -u {} {} -o {}",
                shell_escape(&format!("{}:{}", username, password), CliShell::Bash),
                shell_escape(&url, CliShell::Bash),
                shell_escape(local_path, CliShell::Bash),
            ))
        }
        "fs" => Err(Error::new_not_supported(
            "本地文件系统连接不支持生成 curl 命令",
        )),
        other => Err(Error::new_not_supported(&format!(
            "协议 {} 暂不支持生成 curl 命令",
            other
        ))),
    }
}

#[command]
pub async fn list_files(connection_id: String, path: String) -> ApiResponse<Vec<FileInfo>> {
    match get_connection_config(&connection_id) {
        Ok((protocol_type, config)) => match create_protocol(&protocol_type, &config) {
            Ok(protocol) => match protocol.create_operator() {
                Ok(operator) => {
                    let file_manager = FileManager::new(operator);
                    match file_manager.list(&path).await {
                        Ok(entries) => {
                            let files =
                                entries_to_file_info(&file_manager, entries, protocol_type == "fs")
                                    .await;
                            ApiResponse::success(files)
                        }
                        Err(e) => ApiResponse::error(format!("列出文件失败: {}", e)),
                    }
                }
                Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
            },
            Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
        },
        Err(e) => ApiResponse::error(e),
    }
}

#[command]
pub async fn list_files_paginated(
    connection_id: String,
    path: String,
    page: usize,
    page_size: usize,
) -> ApiResponse<PaginatedFileList> {
    match get_connection_config(&connection_id) {
        Ok((protocol_type, config)) => match create_protocol(&protocol_type, &config) {
            Ok(protocol) => match protocol.create_operator() {
                Ok(operator) => {
                    let file_manager = FileManager::new(operator);
                    match file_manager.list_paginated(&path, page, page_size).await {
                        Ok((entries, total)) => {
                            let files =
                                entries_to_file_info(&file_manager, entries, protocol_type == "fs")
                                    .await;

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
        Err(e) => ApiResponse::error(e),
    }
}

#[command]
pub async fn upload_file(
    app: AppHandle,
    connection_id: String,
    local_path: String,
    remote_path: String,
    emit_progress: bool,
) -> ApiResponse<bool> {
    match get_connection_config(&connection_id) {
        Ok((protocol_type, config)) => match create_protocol(&protocol_type, &config) {
            Ok(protocol) => match protocol.create_operator() {
                Ok(operator) => {
                    let file_manager = FileManager::new(operator);
                    let app_for_progress = app.clone();
                    let upload_id = generate_upload_id();
                    let cancel_flag = register_upload_cancel_token(&upload_id);
                    // 复用进度回调中已读取到的文件总大小，避免完成事件再次 stat 文件
                    // （上传过程中文件被改写会导致二次 stat 拿到错误的尺寸）。
                    let known_total = Arc::new(Mutex::new(0u64));
                    let known_total_for_cb = known_total.clone();
                    let upload_id_for_cb = upload_id.clone();
                    let result = file_manager
                        .upload_with_progress(
                            std::path::Path::new(&local_path),
                            &remote_path,
                            move |transferred, total, file_name| {
                                if let Ok(mut t) = known_total_for_cb.lock() {
                                    *t = total;
                                }
                                maybe_emit_upload_progress(
                                    emit_progress,
                                    &app_for_progress,
                                    UploadProgressPayload {
                                        transferred,
                                        total,
                                        file_name: file_name.to_string(),
                                        file_index: None,
                                        file_count: None,
                                        completed: false,
                                        error: None,
                                        uploaded_count: None,
                                        failed_count: None,
                                        upload_id: Some(upload_id_for_cb.clone()),
                                        cancelled: None,
                                    },
                                );
                            },
                            Some(cancel_flag),
                        )
                        .await;
                    // 无论结果如何，都清理取消令牌
                    remove_upload_cancel_token(&upload_id);

                    match result {
                        Ok(_) => {
                            let total_size = known_total.lock().map(|t| *t).unwrap_or(0u64);
                            let file_name = std::path::Path::new(&local_path)
                                .file_name()
                                .map(|n| n.to_string_lossy().to_string())
                                .unwrap_or_else(|| "uploaded_file".to_string());
                            maybe_emit_upload_progress(
                                emit_progress,
                                &app,
                                UploadProgressPayload {
                                    transferred: total_size,
                                    total: total_size,
                                    file_name,
                                    file_index: None,
                                    file_count: None,
                                    completed: true,
                                    error: None,
                                    uploaded_count: None,
                                    failed_count: None,
                                    upload_id: Some(upload_id),
                                    cancelled: None,
                                },
                            );
                            ApiResponse::success(true)
                        }
                        Err(e) if e.is_cancelled() => {
                            let file_name = std::path::Path::new(&local_path)
                                .file_name()
                                .map(|n| n.to_string_lossy().to_string())
                                .unwrap_or_else(|| "uploaded_file".to_string());
                            maybe_emit_upload_progress(
                                emit_progress,
                                &app,
                                UploadProgressPayload {
                                    transferred: 0,
                                    total: 0,
                                    file_name,
                                    file_index: None,
                                    file_count: None,
                                    completed: true,
                                    error: None,
                                    uploaded_count: None,
                                    failed_count: None,
                                    upload_id: Some(upload_id),
                                    cancelled: Some(true),
                                },
                            );
                            ApiResponse::error("上传已取消".to_string())
                        }
                        Err(e) => {
                            let file_name = std::path::Path::new(&local_path)
                                .file_name()
                                .map(|n| n.to_string_lossy().to_string())
                                .unwrap_or_else(|| "uploaded_file".to_string());
                            maybe_emit_upload_progress(
                                emit_progress,
                                &app,
                                UploadProgressPayload {
                                    transferred: 0,
                                    total: 0,
                                    file_name,
                                    file_index: None,
                                    file_count: None,
                                    completed: true,
                                    error: Some(format!("上传文件失败: {}", e)),
                                    uploaded_count: None,
                                    failed_count: None,
                                    upload_id: Some(upload_id),
                                    cancelled: None,
                                },
                            );
                            ApiResponse::error(format!("上传文件失败: {}", e))
                        }
                    }
                }
                Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
            },
            Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
        },
        Err(e) => ApiResponse::error(e),
    }
}

#[command]
pub async fn upload_directory(
    app: AppHandle,
    connection_id: String,
    local_dir_path: String,
    remote_base_path: String,
) -> ApiResponse<usize> {
    match get_connection_config(&connection_id) {
        Ok((protocol_type, config)) => match create_protocol(&protocol_type, &config) {
            Ok(protocol) => match protocol.create_operator() {
                Ok(operator) => {
                    let file_manager = FileManager::new(operator);
                    let app_for_progress = app.clone();
                    let upload_id = generate_upload_id();
                    let cancel_flag = register_upload_cancel_token(&upload_id);
                    let upload_id_for_cb = upload_id.clone();
                    let result = file_manager
                        .upload_directory_with_progress(
                            std::path::Path::new(&local_dir_path),
                            &remote_base_path,
                            move |file_index, file_count, transferred, total, file_name, error| {
                                emit_upload_progress(
                                    &app_for_progress,
                                    UploadProgressPayload {
                                        transferred,
                                        total,
                                        file_name: file_name.to_string(),
                                        file_index: Some(file_index),
                                        file_count: Some(file_count),
                                        // 单文件失败时通过 error 字段上报，completed 保持 false，
                                        // 由目录上传的最终完成事件统一汇总。
                                        completed: false,
                                        error: error.map(|s| s.to_string()),
                                        uploaded_count: None,
                                        failed_count: None,
                                        upload_id: Some(upload_id_for_cb.clone()),
                                        cancelled: None,
                                    },
                                );
                            },
                            Some(cancel_flag),
                        )
                        .await;
                    // 无论结果如何，都清理取消令牌
                    remove_upload_cancel_token(&upload_id);

                    match result {
                        Ok(res) => {
                            // 部分失败也视为整体失败，但在 error 中说明成功/失败明细，
                            // 便于前端区分"全部成功"与"部分成功"。
                            let payload_error = if res.is_full_success() {
                                None
                            } else {
                                Some(format!(
                                    "部分文件上传失败：成功 {}，失败 {}（共 {}）",
                                    res.uploaded, res.failed, res.total
                                ))
                            };
                            emit_upload_progress(
                                &app,
                                UploadProgressPayload {
                                    transferred: 0,
                                    total: 0,
                                    file_name: String::new(),
                                    file_index: None,
                                    file_count: Some(res.total),
                                    completed: true,
                                    error: payload_error,
                                    uploaded_count: Some(res.uploaded),
                                    failed_count: Some(res.failed),
                                    upload_id: Some(upload_id),
                                    cancelled: None,
                                },
                            );
                            if res.is_full_success() {
                                ApiResponse::success(res.uploaded)
                            } else {
                                ApiResponse::error(format!(
                                    "上传目录失败：成功 {}，失败 {}（共 {}）",
                                    res.uploaded, res.failed, res.total
                                ))
                            }
                        }
                        Err(e) if e.is_cancelled() => {
                            emit_upload_progress(
                                &app,
                                UploadProgressPayload {
                                    transferred: 0,
                                    total: 0,
                                    file_name: String::new(),
                                    file_index: None,
                                    file_count: None,
                                    completed: true,
                                    error: None,
                                    uploaded_count: None,
                                    failed_count: None,
                                    upload_id: Some(upload_id),
                                    cancelled: Some(true),
                                },
                            );
                            ApiResponse::error("上传已取消".to_string())
                        }
                        Err(e) => {
                            emit_upload_progress(
                                &app,
                                UploadProgressPayload {
                                    transferred: 0,
                                    total: 0,
                                    file_name: String::new(),
                                    file_index: None,
                                    file_count: None,
                                    completed: true,
                                    error: Some(format!("上传目录失败: {}", e)),
                                    uploaded_count: None,
                                    failed_count: None,
                                    upload_id: Some(upload_id),
                                    cancelled: None,
                                },
                            );
                            ApiResponse::error(format!("上传目录失败: {}", e))
                        }
                    }
                }
                Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
            },
            Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
        },
        Err(e) => ApiResponse::error(e),
    }
}

#[command]
pub async fn download_file(
    connection_id: String,
    remote_path: String,
    local_path: String,
) -> ApiResponse<bool> {
    match get_connection_config(&connection_id) {
        Ok((protocol_type, config)) => match create_protocol(&protocol_type, &config) {
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
        Err(e) => ApiResponse::error(e),
    }
}

#[command]
pub async fn build_download_command(
    connection_id: String,
    remote_path: String,
    target_shell: String,
) -> ApiResponse<String> {
    match get_connection_config(&connection_id) {
        Ok((protocol_type, config)) => match CliShell::from_target(&target_shell) {
            Ok(shell) => match build_download_cli_command(
                "main_cli",
                &protocol_type,
                &config,
                &remote_path,
                &default_download_target(&remote_path),
                shell,
            ) {
                Ok(command) => ApiResponse::success(command),
                Err(e) => ApiResponse::error(format!("生成下载命令失败: {}", e)),
            },
            Err(e) => ApiResponse::error(format!("生成下载命令失败: {}", e)),
        },
        Err(e) => ApiResponse::error(e),
    }
}

#[command]
pub async fn build_download_curl_command(
    connection_id: String,
    remote_path: String,
) -> ApiResponse<String> {
    match get_connection_config(&connection_id) {
        Ok((protocol_type, config)) => match format_download_curl_command(
            &protocol_type,
            &config,
            &remote_path,
            &default_download_target(&remote_path),
        ) {
            Ok(command) => ApiResponse::success(command),
            Err(e) => ApiResponse::error(format!("生成 curl 命令失败: {}", e)),
        },
        Err(e) => ApiResponse::error(e),
    }
}

#[command]
pub fn copy_text_to_clipboard(app: tauri::AppHandle, text: String) -> ApiResponse<bool> {
    match app.clipboard().write_text(text) {
        Ok(_) => ApiResponse::success(true),
        Err(e) => ApiResponse::error(format!("复制到剪贴板失败: {}", e)),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathExistsInfo {
    exists: bool,
    is_dir: bool,
}

#[command]
pub async fn check_file_exists(connection_id: String, path: String) -> ApiResponse<PathExistsInfo> {
    match get_connection_config(&connection_id) {
        Ok((protocol_type, config)) => match create_protocol(&protocol_type, &config) {
            Ok(protocol) => match protocol.create_operator() {
                Ok(operator) => {
                    let file_manager = FileManager::new(operator);
                    match file_manager.upload_target_exists(&path).await {
                        Ok((exists, is_dir)) => {
                            ApiResponse::success(PathExistsInfo { exists, is_dir })
                        }
                        Err(e) => ApiResponse::error(format!("检查文件是否存在失败: {}", e)),
                    }
                }
                Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
            },
            Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
        },
        Err(e) => ApiResponse::error(e),
    }
}

#[command]
pub async fn delete_file(connection_id: String, path: String) -> ApiResponse<bool> {
    match get_connection_config(&connection_id) {
        Ok((protocol_type, config)) => match create_protocol(&protocol_type, &config) {
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
        Err(e) => ApiResponse::error(e),
    }
}

#[command]
pub async fn create_directory(connection_id: String, path: String) -> ApiResponse<bool> {
    match get_connection_config(&connection_id) {
        Ok((protocol_type, config)) => match create_protocol(&protocol_type, &config) {
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
        Err(e) => ApiResponse::error(e),
    }
}

#[command]
pub async fn get_directory_count(connection_id: String, path: String) -> ApiResponse<usize> {
    match get_connection_config(&connection_id) {
        Ok((protocol_type, config)) => match create_protocol(&protocol_type, &config) {
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
        Err(e) => ApiResponse::error(e),
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

    #[test]
    fn builds_ftp_curl_download_command() {
        let mut config = HashMap::new();
        config.insert("host".to_string(), "ftp.example.com".to_string());
        config.insert("port".to_string(), "21".to_string());
        config.insert("username".to_string(), "demo".to_string());
        config.insert("password".to_string(), "secret".to_string());
        config.insert("root_dir".to_string(), "/upload".to_string());

        let command = super::format_download_curl_command(
            "ftp",
            &config,
            "/packages/app.tar.gz",
            "./app.tar.gz",
        )
        .unwrap();

        assert_eq!(
            command,
            r#"curl -L -u 'demo:secret' 'ftp://ftp.example.com:21/upload/packages/app.tar.gz' -o './app.tar.gz'"#
        );
    }

    #[test]
    fn builds_s3_curl_download_command() {
        let mut config = HashMap::new();
        config.insert("bucket".to_string(), "my-bucket".to_string());
        config.insert("region".to_string(), "us-east-1".to_string());
        config.insert("access_key".to_string(), "AKIA123".to_string());
        config.insert("secret_key".to_string(), "secret".to_string());

        let command = super::format_download_curl_command(
            "s3",
            &config,
            "/release packages/app.tar.gz",
            "./app.tar.gz",
        )
        .unwrap();

        assert_eq!(
            command,
            r#"curl -L 'https://my-bucket.s3.us-east-1.amazonaws.com/release%20packages/app.tar.gz' --aws-sigv4 'aws:amz:us-east-1:s3' --user 'AKIA123:secret' -o './app.tar.gz'"#
        );
    }

    #[test]
    fn rejects_fs_curl_download_command() {
        let config = HashMap::new();
        let error =
            super::format_download_curl_command("fs", &config, "/tmp/file.txt", "./file.txt")
                .unwrap_err()
                .to_string();

        assert!(error.contains("本地文件系统连接不支持生成 curl 命令"));
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
    match get_connection_config(&connection_id) {
        Ok((protocol_type, config)) => match create_protocol(&protocol_type, &config) {
            Ok(protocol) => match protocol.create_operator() {
                Ok(operator) => {
                    let file_manager = FileManager::new(operator);
                    match file_manager
                        .search_paginated(&path, &query, page, page_size)
                        .await
                    {
                        Ok((entries, total)) => {
                            let files =
                                entries_to_file_info(&file_manager, entries, protocol_type == "fs")
                                    .await;

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
        Err(e) => ApiResponse::error(e),
    }
}

async fn entries_to_file_info(
    file_manager: &FileManager,
    entries: Vec<opendal::Entry>,
    enrich_metadata: bool,
) -> Vec<FileInfo> {
    if enrich_metadata {
        file_manager
            .enrich_entries_metadata(entries)
            .await
            .into_iter()
            .map(Into::into)
            .collect()
    } else {
        entries.into_iter().map(Into::into).collect()
    }
}

#[command]
pub async fn get_file_content(
    connection_id: String,
    path: String,
    r#type: String, // 使用 r#type 因为 type 是 Rust 关键字
) -> ApiResponse<serde_json::Value> {
    match get_connection_config(&connection_id) {
        Ok((protocol_type, config)) => {
            match create_protocol(&protocol_type, &config) {
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
                                    return ApiResponse::error(format!("获取文件信息失败: {}", e));
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
                                                .map(|b| serde_json::Value::Number(b.into()))
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
                                                ApiResponse::error(
                                                    "文件不是有效的UTF-8格式，请尝试二进制预览"
                                                        .to_string(),
                                                )
                                            }
                                        }
                                    }
                                }
                                Err(e) => ApiResponse::error(format!("读取文件失败: {}", e)),
                            }
                        }
                        Err(e) => ApiResponse::error(format!("创建操作符失败: {}", e)),
                    }
                }
                Err(e) => ApiResponse::error(format!("创建协议失败: {}", e)),
            }
        }
        Err(e) => ApiResponse::error(e),
    }
}

#[command]
pub async fn batch_download_files(
    connection_id: String,
    file_paths: Vec<String>,
    save_path: String,
) -> ApiResponse<bool> {
    match get_connection_config(&connection_id) {
        Ok((protocol_type, config)) => match create_protocol(&protocol_type, &config) {
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
        Err(e) => ApiResponse::error(e),
    }
}

fn create_operator_for_connection(
    connection_id: &str,
) -> std::result::Result<opendal::Operator, String> {
    let (protocol_type, config) = get_connection_config(connection_id)?;
    let protocol =
        create_protocol(&protocol_type, &config).map_err(|e| format!("创建协议失败: {}", e))?;
    protocol
        .create_operator()
        .map_err(|e| format!("创建操作符失败: {}", e))
}

#[command]
pub async fn copy_files_between_connections(
    app: AppHandle,
    source_connection_id: String,
    source_paths: Vec<String>,
    target_connection_id: String,
    target_base_path: String,
    overwrite: Option<bool>,
) -> ApiResponse<CopyResultSummary> {
    if source_paths.is_empty() {
        return ApiResponse::error("未指定要复制的文件".to_string());
    }

    if source_connection_id == target_connection_id {
        return ApiResponse::error("源连接与目标连接相同，无法跨连接复制".to_string());
    }

    let overwrite = overwrite.unwrap_or(false);

    let src_operator = match create_operator_for_connection(&source_connection_id) {
        Ok(op) => op,
        Err(e) => return ApiResponse::error(format!("创建源连接操作符失败: {}", e)),
    };
    let dst_operator = match create_operator_for_connection(&target_connection_id) {
        Ok(op) => op,
        Err(e) => return ApiResponse::error(format!("创建目标连接操作符失败: {}", e)),
    };

    let src_file_manager = FileManager::new(src_operator.clone());
    let copy_items = match src_file_manager
        .collect_remote_copy_items(&source_paths, &target_base_path)
        .await
    {
        Ok(items) => items,
        Err(e) => return ApiResponse::error(format!("收集复制项失败: {}", e)),
    };

    if copy_items.is_empty() {
        return ApiResponse::error("没有可复制的文件".to_string());
    }

    // 预先创建目标侧所需的父目录（FTP / 文件系统类后端写入嵌套文件时必需）
    ensure_remote_parent_dirs(&dst_operator, copy_items.iter().map(|(_, d)| d.as_str())).await;

    let upload_id = generate_upload_id();
    let cancel_flag = register_upload_cancel_token(&upload_id);
    let file_count = copy_items.len();
    let mut copied_count = 0usize;
    let mut failed_count = 0usize;

    for (index, (src_path, dst_path)) in copy_items.iter().enumerate() {
        if cancel_flag.load(Ordering::Relaxed) {
            remove_upload_cancel_token(&upload_id);
            emit_upload_progress(
                &app,
                UploadProgressPayload {
                    transferred: 0,
                    total: 0,
                    file_name: String::new(),
                    file_index: Some(index),
                    file_count: Some(file_count),
                    completed: true,
                    error: None,
                    uploaded_count: Some(copied_count),
                    failed_count: Some(failed_count),
                    upload_id: Some(upload_id.clone()),
                    cancelled: Some(true),
                },
            );
            return ApiResponse::error("复制已取消".to_string());
        }

        let app_for_progress = app.clone();
        let upload_id_for_cb = upload_id.clone();
        let file_index = index;
        let result = copy_remote_file_between_operators(
            &src_operator,
            &dst_operator,
            src_path,
            dst_path,
            overwrite,
            move |transferred, total, file_name| {
                emit_upload_progress(
                    &app_for_progress,
                    UploadProgressPayload {
                        transferred,
                        total,
                        file_name: file_name.to_string(),
                        file_index: Some(file_index),
                        file_count: Some(file_count),
                        completed: false,
                        error: None,
                        uploaded_count: None,
                        failed_count: None,
                        upload_id: Some(upload_id_for_cb.clone()),
                        cancelled: None,
                    },
                );
            },
            Some(cancel_flag.clone()),
        )
        .await;

        match result {
            Ok(()) => {
                copied_count += 1;
            }
            Err(e) if e.is_cancelled() => {
                failed_count += 1;
                remove_upload_cancel_token(&upload_id);
                emit_upload_progress(
                    &app,
                    UploadProgressPayload {
                        transferred: 0,
                        total: 0,
                        file_name: remote_display_name(src_path),
                        file_index: Some(index),
                        file_count: Some(file_count),
                        completed: true,
                        error: None,
                        uploaded_count: Some(copied_count),
                        failed_count: Some(failed_count),
                        upload_id: Some(upload_id),
                        cancelled: Some(true),
                    },
                );
                return ApiResponse::error("复制已取消".to_string());
            }
            // 单文件失败容错：记录失败后继续处理剩余文件，与目录上传行为一致
            Err(e) => {
                failed_count += 1;
                warn!(
                    "复制文件失败 ({}/{}): {} -> {} : {}",
                    index + 1,
                    file_count,
                    src_path,
                    dst_path,
                    e
                );
                emit_upload_progress(
                    &app,
                    UploadProgressPayload {
                        transferred: 0,
                        total: 0,
                        file_name: remote_display_name(src_path),
                        file_index: Some(index),
                        file_count: Some(file_count),
                        completed: false,
                        error: Some(e.to_string()),
                        uploaded_count: Some(copied_count),
                        failed_count: Some(failed_count),
                        upload_id: Some(upload_id.clone()),
                        cancelled: None,
                    },
                );
            }
        }
    }

    remove_upload_cancel_token(&upload_id);
    emit_upload_progress(
        &app,
        UploadProgressPayload {
            transferred: 0,
            total: 0,
            file_name: String::new(),
            file_index: Some(file_count),
            file_count: Some(file_count),
            completed: true,
            error: None,
            uploaded_count: Some(copied_count),
            failed_count: Some(failed_count),
            upload_id: Some(upload_id),
            cancelled: None,
        },
    );
    ApiResponse::success(CopyResultSummary {
        copied: copied_count,
        failed: failed_count,
        total: file_count,
    })
}

/// 跨连接复制结果摘要
#[derive(Debug, Clone, Copy, Serialize)]
pub struct CopyResultSummary {
    pub copied: usize,
    pub failed: usize,
    pub total: usize,
}

/// 为一批目标路径提取并创建所需的父目录。
///
/// 对 S3 等对象存储为幂等无副作用操作；对 FTP / 文件系统类后端则是
/// 写入嵌套文件所必需的前置步骤。创建失败仅记录日志，不阻断主流程。
async fn ensure_remote_parent_dirs<'a, I>(operator: &Operator, paths: I)
where
    I: IntoIterator<Item = &'a str>,
{
    let mut remote_dirs = std::collections::HashSet::new();
    for dst_path in paths {
        if let Some((parent, _)) = dst_path.rsplit_once('/') {
            if !parent.is_empty() && parent != "/" {
                remote_dirs.insert(format!("{}/", parent));
            }
        }
    }
    for remote_dir in remote_dirs {
        let trimmed = remote_dir.trim_start_matches('/');
        if let Err(e) = operator.create_dir(trimmed).await {
            debug!("创建远程目录失败 {} (可忽略): {}", remote_dir, e);
        }
    }
}

fn remote_display_name(path: &str) -> String {
    let p = path.trim_end_matches('/');
    p.rsplit('/').next().unwrap_or(p).to_string()
}
