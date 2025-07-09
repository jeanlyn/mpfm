# 新增协议支持指南

本指南说明如何使用OpenDAL为多协议文件管理器添加新协议支持。

## 概述

多协议文件管理器基于OpenDAL构建，OpenDAL提供了访问不同存储服务的统一接口。添加新协议包括：

1. 实现协议特定逻辑
2. 集成到协议工厂
3. 编写全面的测试
4. 更新文档

## 详细步骤

### 步骤1：检查OpenDAL支持

首先，验证OpenDAL是否支持您的目标协议：
- 查看[OpenDAL文档](https://opendal.apache.org/)
- 在功能列表中查找服务
- 确保服务稳定且文档完善

### 步骤2：添加依赖

更新`Cargo.toml`以包含新的协议服务：

```toml
[dependencies]
opendal = { version = "0.53.1", features = ["services-s3", "services-fs", "services-ftp", "services-YOUR_PROTOCOL"] }
```

### 步骤3：实现协议

创建新文件`src/protocols/your_protocol.rs`：

```rust
use std::collections::HashMap;
use log::debug;
use opendal::{services, Operator};
use super::traits::{Capabilities, Protocol};
use crate::core::error::{Error, Result};

#[derive(Debug)]
pub struct YourProtocol {
    // 协议特定字段
    host: String,
    port: u16,
    // 添加其他必需字段
}

impl YourProtocol {
    pub fn new(/* 参数 */) -> Self {
        Self {
            // 初始化字段
        }
    }

    pub fn from_config(config: &HashMap<String, String>) -> Result<Self> {
        // 解析配置并验证必需字段
        let host = config
            .get("host")
            .ok_or_else(|| Error::new_config("缺少 'host' 参数"))?
            .clone();
        
        // 添加其他字段的验证
        
        Ok(Self::new(/* 解析的参数 */))
    }
}

impl Protocol for YourProtocol {
    fn create_operator(&self) -> Result<Operator> {
        debug!("为 {} 创建操作符", self.host);

        // 创建服务配置
        let builder = services::YourService::default()
            .endpoint(&format!("protocol://{}:{}", self.host, self.port));
            // 添加其他配置

        // 创建并返回操作符
        let op = match Operator::new(builder) {
            Ok(op_builder) => op_builder.finish(),
            Err(e) => return Err(Error::from(e)),
        };

        Ok(op)
    }

    fn get_id(&self) -> String {
        format!("protocol://{}:{}", self.host, self.port)
    }

    fn get_name(&self) -> String {
        format!("您的协议 ({}:{})", self.host, self.port)
    }

    fn get_capabilities(&self) -> Capabilities {
        Capabilities::default()
            .with_list(true)
            .with_read(true)
            .with_write(true)
            .with_delete(true)
            .with_create_dir(true)
            // 根据协议支持设置能力
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_protocol_from_config() {
        let mut config = HashMap::new();
        config.insert("host".to_string(), "example.com".to_string());
        // 添加测试配置

        let protocol = YourProtocol::from_config(&config).unwrap();
        assert_eq!(protocol.host, "example.com");
    }

    #[test]
    fn test_protocol_capabilities() {
        let protocol = YourProtocol::new(/* 测试参数 */);
        let caps = protocol.get_capabilities();
        assert!(caps.can_read);
        assert!(caps.can_write);
    }
}
```

### 步骤4：更新模块声明

更新`src/protocols/mod.rs`：

```rust
pub mod fs;
pub mod s3;
pub mod ftp;
pub mod your_protocol; // 添加此行

pub use traits::Protocol;

pub fn create_protocol(
    protocol_type: &str,
    config: &std::collections::HashMap<String, String>,
) -> crate::core::error::Result<Box<dyn Protocol>> {
    match protocol_type {
        "s3" => {
            let protocol = s3::S3Protocol::from_config(config)?;
            Ok(Box::new(protocol))
        }
        "fs" => {
            let protocol = fs::FSProtocol::from_config(config)?;
            Ok(Box::new(protocol))
        }
        "ftp" => {
            let protocol = ftp::FtpProtocol::from_config(config)?;
            Ok(Box::new(protocol))
        }
        "your_protocol" => { // 添加此情况
            let protocol = your_protocol::YourProtocol::from_config(config)?;
            Ok(Box::new(protocol))
        }
        _ => Err(crate::core::error::Error::new_not_supported(&format!(
            "不支持的协议类型: {}",
            protocol_type
        ))),
    }
}
```

### 步骤5：创建集成测试

创建`tests/your_protocol_integration_tests.rs`：

```rust
use std::collections::HashMap;
use multi_protocol_file_manager::protocols::{create_protocol, your_protocol::YourProtocol, Protocol};

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn test_create_protocol_via_factory() {
        let mut config = HashMap::new();
        config.insert("host".to_string(), "test.example.com".to_string());
        // 添加必需配置

        let protocol = create_protocol("your_protocol", &config).unwrap();
        assert!(protocol.get_name().contains("您的协议"));
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;

    fn create_test_config() -> HashMap<String, String> {
        let mut config = HashMap::new();
        config.insert("host".to_string(), "127.0.0.1".to_string());
        // 添加测试服务器配置
        config
    }

    #[tokio::test]
    async fn test_basic_operations() {
        // 如果没有测试服务器可用则跳过
        let config = create_test_config();
        let protocol = YourProtocol::from_config(&config).unwrap();
        let operator = protocol.create_operator().unwrap();

        // 测试基本操作
        let test_content = "你好，世界！";
        let test_path = "test_file.txt";
        
        // 写入测试
        let write_result = operator.write(test_path, test_content).await;
        assert!(write_result.is_ok());

        // 读取测试
        let read_result = operator.read(test_path).await;
        assert!(read_result.is_ok());
        
        let content = read_result.unwrap();
        assert_eq!(content.to_vec(), test_content.as_bytes());

        // 清理
        let _ = operator.delete(test_path).await;
    }
}
```

### 步骤6：创建测试环境设置

如需要，创建测试设置脚本：

```bash
#!/bin/bash
# scripts/setup_your_protocol_test.sh

echo "为您的协议设置测试环境..."

# 添加测试服务器/服务的设置逻辑
# 例如：Docker容器、本地服务等

echo "测试环境准备就绪！"
```

### 步骤7：更新文档

1. 创建协议特定文档
2. 更新主README添加新协议支持
3. 添加配置示例
4. 记录任何限制或特殊要求

### 步骤8：测试

运行全面测试：

```bash
# 单元测试
cargo test protocols::your_protocol

# 集成测试（如果测试服务器可用）
cargo test --test your_protocol_integration_tests

# 所有测试
cargo test
```

## 配置示例

### 基本配置

```rust
let mut config = HashMap::new();
config.insert("host".to_string(), "your-server.com".to_string());
config.insert("port".to_string(), "12345".to_string());
config.insert("username".to_string(), "user".to_string());
config.insert("password".to_string(), "password".to_string());

let protocol = create_protocol("your_protocol", &config)?;
```

### 高级配置

```rust
let mut config = HashMap::new();
config.insert("host".to_string(), "your-server.com".to_string());
config.insert("port".to_string(), "12345".to_string());
config.insert("username".to_string(), "user".to_string());
config.insert("password".to_string(), "password".to_string());
config.insert("ssl".to_string(), "true".to_string());
config.insert("timeout".to_string(), "30".to_string());
config.insert("root".to_string(), "/data".to_string());

let protocol = create_protocol("your_protocol", &config)?;
```

## 最佳实践

1. **错误处理**：使用适当的错误类型并提供有意义的错误消息
2. **配置验证**：在`from_config()`中验证所有必需参数
3. **测试**：编写单元测试和集成测试
4. **文档**：记录所有配置参数及其默认值
5. **能力**：准确报告协议支持的操作
6. **日志记录**：使用适当的日志级别进行调试和监控

## 常见问题

### 编译错误
- 确保OpenDAL功能正确指定
- 检查所有导入都可用
- 验证特征实现完整

### 运行时错误
- 验证配置参数
- 检查网络连接和凭据
- 确保目标服务可访问

### 测试失败
- 验证测试环境设置
- 检查服务可用性
- 审查配置参数

## 示例：FTP协议实现

完整示例请参考FTP协议实现：
- `src/protocols/ftp.rs` - 协议实现
- `tests/ftp_integration_tests.rs` - 集成测试
- `scripts/setup_ftp_test.sh` - 测试环境设置
- `tests/FTP_TEST_README.md` - 详细测试指南

此示例演示了本指南中涵盖的所有概念。
