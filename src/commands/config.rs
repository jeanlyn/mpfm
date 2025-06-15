use std::collections::HashMap;
use tauri::command;
use tauri::Manager;

use super::types::ApiResponse;

#[command]
pub async fn save_app_config(
    app: tauri::AppHandle,
    key: String,
    data: String,
) -> ApiResponse<bool> {
    match app.path().app_config_dir() {
        Ok(config_dir) => {
            if let Err(e) = std::fs::create_dir_all(&config_dir) {
                return ApiResponse::error(format!("创建配置目录失败: {}", e));
            }

            let config_file = config_dir.join(format!("{}.json", key));
            match std::fs::write(&config_file, data) {
                Ok(_) => ApiResponse::success(true),
                Err(e) => ApiResponse::error(format!("保存配置失败: {}", e)),
            }
        }
        Err(e) => ApiResponse::error(format!("获取配置目录失败: {}", e)),
    }
}

#[command]
pub async fn load_app_config(app: tauri::AppHandle, key: String) -> ApiResponse<String> {
    match app.path().app_config_dir() {
        Ok(config_dir) => {
            let config_file = config_dir.join(format!("{}.json", key));
            if config_file.exists() {
                match std::fs::read_to_string(&config_file) {
                    Ok(content) => ApiResponse::success(content),
                    Err(e) => ApiResponse::error(format!("读取配置失败: {}", e)),
                }
            } else {
                ApiResponse::success(String::new()) // 文件不存在返回空字符串
            }
        }
        Err(e) => ApiResponse::error(format!("获取配置目录失败: {}", e)),
    }
}

#[command]
pub async fn delete_app_config(app: tauri::AppHandle, key: String) -> ApiResponse<bool> {
    match app.path().app_config_dir() {
        Ok(config_dir) => {
            let config_file = config_dir.join(format!("{}.json", key));
            if config_file.exists() {
                match std::fs::remove_file(&config_file) {
                    Ok(_) => ApiResponse::success(true),
                    Err(e) => ApiResponse::error(format!("删除配置失败: {}", e)),
                }
            } else {
                ApiResponse::success(true) // 文件不存在也算成功
            }
        }
        Err(e) => ApiResponse::error(format!("获取配置目录失败: {}", e)),
    }
}

#[command]
pub async fn export_app_config(
    app: tauri::AppHandle,
    keys: Vec<String>,
) -> ApiResponse<HashMap<String, String>> {
    match app.path().app_config_dir() {
        Ok(config_dir) => {
            let mut exported_data = HashMap::new();
            for key in keys {
                let config_file = config_dir.join(format!("{}.json", key));
                if config_file.exists() {
                    if let Ok(content) = std::fs::read_to_string(&config_file) {
                        exported_data.insert(key, content);
                    }
                }
            }
            ApiResponse::success(exported_data)
        }
        Err(e) => ApiResponse::error(format!("获取配置目录失败: {}", e)),
    }
}

#[command]
pub async fn import_app_config(
    app: tauri::AppHandle,
    config_data: HashMap<String, String>,
) -> ApiResponse<bool> {
    match app.path().app_config_dir() {
        Ok(config_dir) => {
            if let Err(e) = std::fs::create_dir_all(&config_dir) {
                return ApiResponse::error(format!("创建配置目录失败: {}", e));
            }

            for (key, data) in config_data {
                let config_file = config_dir.join(format!("{}.json", key));
                if let Err(e) = std::fs::write(&config_file, data) {
                    return ApiResponse::error(format!("导入配置 {} 失败: {}", key, e));
                }
            }
            ApiResponse::success(true)
        }
        Err(e) => ApiResponse::error(format!("获取配置目录失败: {}", e)),
    }
}
