pub mod error;
pub mod config;
pub mod file;

pub use error::{Error, Result};
pub use config::{ConnectionConfig, ConnectionManager};
pub use file::FileManager;

pub mod operator {
    use opendal::Operator;
    use crate::core::Result;
    use crate::protocols::Protocol;

    /// 创建 Operator 的工厂函数
    pub fn create_operator(protocol: &dyn Protocol) -> Result<Operator> {
        protocol.create_operator()
    }

    /// 根据协议创建文件管理器
    pub fn create_file_manager(protocol: &dyn Protocol) -> Result<super::FileManager> {
        let operator = create_operator(protocol)?;
        Ok(super::FileManager::new(operator))
    }
}