use crate::core::config::ConnectionManager;

/// 获取连接管理器实例
pub fn get_connection_manager() -> Result<ConnectionManager, crate::core::error::Error> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| crate::core::error::Error::new_other("无法获取配置目录"))?
        .join("mpfm");
    
    let config_file = config_dir.join("connections.json");
    ConnectionManager::new(config_file)
}
