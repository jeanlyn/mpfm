pub mod traits;
pub mod s3;

pub use traits::Protocol;

/// 工厂函数根据协议类型创建协议实例
pub fn create_protocol(protocol_type: &str, config: &std::collections::HashMap<String, String>) -> crate::core::error::Result<Box<dyn Protocol>> {
    match protocol_type {
        "s3" => {
            let protocol = s3::S3Protocol::from_config(config)?;
            Ok(Box::new(protocol))
        },
        // 其他协议类型在这里添加
        _ => Err(crate::core::error::Error::new_not_supported(&format!(
            "不支持的协议类型: {}", protocol_type
        ))),
    }
}