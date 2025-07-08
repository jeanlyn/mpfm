use std::collections::HashMap;

use log::debug;
use opendal::{services, Operator};

use super::traits::{Capabilities, Protocol};
use crate::core::error::{Error, Result};

#[derive(Debug)]
pub struct FtpProtocol {
    host: String,
    port: u16,
    username: String,
    password: String,
    root: Option<String>,
}

impl FtpProtocol {
    pub fn new(
        host: String,
        port: u16,
        username: String,
        password: String,
        root: Option<String>,
    ) -> Self {
        Self {
            host,
            port,
            username,
            password,
            root,
        }
    }

    pub fn from_config(config: &HashMap<String, String>) -> Result<Self> {
        let host = config
            .get("host")
            .ok_or_else(|| Error::new_config("FTP配置缺少 'host' 参数"))?
            .clone();

        let port = config
            .get("port")
            .map(|p| p.parse::<u16>())
            .unwrap_or(Ok(21))
            .map_err(|_| Error::new_config("FTP端口配置无效"))?;

        let username = config
            .get("username")
            .ok_or_else(|| Error::new_config("FTP配置缺少 'username' 参数"))?
            .clone();

        let password = config
            .get("password")
            .ok_or_else(|| Error::new_config("FTP配置缺少 'password' 参数"))?
            .clone();

        let root = config.get("root").cloned();

        Ok(Self::new(host, port, username, password, root))
    }
}

impl Protocol for FtpProtocol {
    fn create_operator(&self) -> Result<Operator> {
        debug!(
            "创建 FTP 操作符, host: {}, port: {}, username: {}",
            self.host, self.port, self.username
        );

        // 创建 FTP 服务配置
        let mut builder = services::Ftp::default()
            .endpoint(&format!("ftp://{}:{}", self.host, self.port))
            .user(&self.username)
            .password(&self.password);

        if let Some(root) = &self.root {
            debug!("使用根目录: {}", root);
            builder = builder.root(root);
        }

        // 创建 Operator
        let op = match Operator::new(builder) {
            Ok(op_builder) => op_builder.finish(),
            Err(e) => return Err(Error::from(e)),
        };

        Ok(op)
    }

    fn get_id(&self) -> String {
        format!("ftp://{}@{}:{}", self.username, self.host, self.port)
    }

    fn get_name(&self) -> String {
        format!("FTP ({}@{}:{})", self.username, self.host, self.port)
    }

    fn get_capabilities(&self) -> Capabilities {
        Capabilities::default()
            .with_list(true)
            .with_read(true)
            .with_write(true)
            .with_delete(true)
            .with_create_dir(true)
            .with_rename(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_ftp_protocol_from_config() {
        let mut config = HashMap::new();
        config.insert("host".to_string(), "127.0.0.1".to_string());
        config.insert("port".to_string(), "2121".to_string());
        config.insert("username".to_string(), "testuser".to_string());
        config.insert("password".to_string(), "testpass".to_string());
        config.insert("root".to_string(), "/upload".to_string());

        let protocol = FtpProtocol::from_config(&config).unwrap();
        assert_eq!(protocol.host, "127.0.0.1");
        assert_eq!(protocol.port, 2121);
        assert_eq!(protocol.username, "testuser");
        assert_eq!(protocol.password, "testpass");
        assert_eq!(protocol.root, Some("/upload".to_string()));
    }

    #[test]
    fn test_ftp_protocol_from_config_default_port() {
        let mut config = HashMap::new();
        config.insert("host".to_string(), "ftp.example.com".to_string());
        config.insert("username".to_string(), "user".to_string());
        config.insert("password".to_string(), "pass".to_string());

        let protocol = FtpProtocol::from_config(&config).unwrap();
        assert_eq!(protocol.host, "ftp.example.com");
        assert_eq!(protocol.port, 21);
        assert_eq!(protocol.username, "user");
        assert_eq!(protocol.password, "pass");
        assert_eq!(protocol.root, None);
    }

    #[test]
    fn test_ftp_protocol_missing_config() {
        let config = HashMap::new();
        let result = FtpProtocol::from_config(&config);
        assert!(result.is_err());
    }

    #[test]
    fn test_ftp_protocol_get_id() {
        let protocol = FtpProtocol::new(
            "example.com".to_string(),
            21,
            "user".to_string(),
            "pass".to_string(),
            None,
        );
        assert_eq!(protocol.get_id(), "ftp://user@example.com:21");
    }

    #[test]
    fn test_ftp_protocol_get_name() {
        let protocol = FtpProtocol::new(
            "example.com".to_string(),
            2121,
            "user".to_string(),
            "pass".to_string(),
            None,
        );
        assert_eq!(protocol.get_name(), "FTP (user@example.com:2121)");
    }

    #[test]
    fn test_ftp_protocol_capabilities() {
        let protocol = FtpProtocol::new(
            "example.com".to_string(),
            21,
            "user".to_string(),
            "pass".to_string(),
            None,
        );
        let caps = protocol.get_capabilities();
        assert!(caps.can_list);
        assert!(caps.can_read);
        assert!(caps.can_write);
        assert!(caps.can_delete);
        assert!(caps.can_create_dir);
        assert!(caps.can_rename);
        assert!(!caps.can_copy); // FTP通常不支持服务器端复制
        assert!(!caps.can_batch_delete); // FTP通常不支持批量删除
    }
}
