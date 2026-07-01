use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use crate::core::config::{ConnectionConfig, ConnectionManager};

static CONNECTION_MANAGER: OnceLock<Mutex<ConnectionManager>> = OnceLock::new();

/// 连接配置文件路径
pub fn connections_config_path() -> Result<PathBuf, crate::core::error::Error> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| crate::core::error::Error::new_other("无法获取配置目录"))?
        .join("mpfm");

    Ok(config_dir.join("connections.json"))
}

fn connection_manager() -> &'static Mutex<ConnectionManager> {
    CONNECTION_MANAGER.get_or_init(|| {
        Mutex::new(
            ConnectionManager::new(connections_config_path().expect("无法获取连接配置路径"))
                .expect("failed to initialize connection manager"),
        )
    })
}

/// 获取连接管理器锁（配置在首次调用时加载，之后复用内存缓存）
pub fn with_connection_manager<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce(&ConnectionManager) -> Result<T, String>,
{
    let manager = connection_manager()
        .lock()
        .map_err(|e| format!("连接管理器锁定失败: {}", e))?;
    f(&manager)
}

/// 获取连接管理器可变锁
pub fn with_connection_manager_mut<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce(&mut ConnectionManager) -> Result<T, String>,
{
    let mut manager = connection_manager()
        .lock()
        .map_err(|e| format!("连接管理器锁定失败: {}", e))?;
    f(&mut manager)
}

/// 按 ID 获取连接配置副本（锁在返回前释放，可安全用于 async 命令）
pub fn get_connection_config(
    connection_id: &str,
) -> Result<(String, HashMap<String, String>), String> {
    with_connection_manager(|manager| {
        let config = manager
            .get_connection(connection_id)
            .ok_or_else(|| "Connection not found".to_string())?;
        Ok((config.protocol_type.clone(), config.config.clone()))
    })
}

/// 获取全部连接配置副本
pub fn list_connection_configs() -> Result<Vec<ConnectionConfig>, String> {
    with_connection_manager(|manager| Ok(manager.get_connections().into_iter().cloned().collect()))
}

/// 从磁盘重新加载连接配置并返回最新列表
pub fn reload_connection_configs() -> Result<Vec<ConnectionConfig>, String> {
    with_connection_manager_mut(|manager| {
        manager.reload_from_disk().map_err(|e| e.to_string())?;
        Ok(manager.get_connections().into_iter().cloned().collect())
    })
}
