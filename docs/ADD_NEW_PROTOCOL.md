# 添加新协议指南

本文档详细说明如何在多协议文件管理器中添加新的存储协议支持。

## 概述

添加新协议需要以下步骤：
1. 修改依赖配置
2. 实现协议结构体
3. 注册协议到工厂函数
4. 编写单元测试
5. 编写集成测试
6. 创建测试环境
7. 更新文档

## 详细步骤

### 1. 修改依赖配置

在 `Cargo.toml` 中添加对应的 OpenDAL 服务特性：

```toml
[dependencies]
opendal = { version = "0.53.1", features = ["services-s3", "services-fs", "services-ftp"] }
```

### 2. 实现协议结构体

在 `src/protocols/` 目录下创建新的协议文件，例如 `ftp.rs`：

```rust
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
        // 解析配置参数
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
            // 根据协议特性设置其他能力
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_protocol_from_config() {
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

    // 其他单元测试...
}
```

### 3. 注册协议到工厂函数

在 `src/protocols/mod.rs` 中：

1. 添加模块声明：
```rust
pub mod ftp;
```

2. 更新工厂函数：
```rust
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
        _ => Err(crate::core::error::Error::new_not_supported(&format!(
            "不支持的协议类型: {}",
            protocol_type
        ))),
    }
}
```

### 4. 编写单元测试

在协议文件中添加 `#[cfg(test)]` 模块，测试：
- 配置解析
- 参数验证
- 基本功能
- 错误处理

### 5. 编写集成测试

在 `tests/` 目录下创建集成测试文件，例如 `ftp_integration_tests.rs`：

```rust
use std::collections::HashMap;
use multi_protocol_file_manager::protocols::{create_protocol, ftp::FtpProtocol, Protocol};

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn test_create_protocol_via_factory() {
        let mut config = HashMap::new();
        config.insert("host".to_string(), "127.0.0.1".to_string());
        config.insert("username".to_string(), "testuser".to_string());
        config.insert("password".to_string(), "testpass".to_string());

        let protocol = create_protocol("ftp", &config).unwrap();
        assert!(protocol.get_name().contains("FTP"));
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use opendal::EntryMode;

    fn create_test_config() -> HashMap<String, String> {
        let mut config = HashMap::new();
        config.insert("host".to_string(), "127.0.0.1".to_string());
        config.insert("port".to_string(), "2121".to_string());
        config.insert("username".to_string(), "testuser".to_string());
        config.insert("password".to_string(), "testpass".to_string());
        config
    }

    async fn check_server_available() -> bool {
        let config = create_test_config();
        let protocol = match FtpProtocol::from_config(&config) {
            Ok(p) => p,
            Err(_) => return false,
        };

        let operator = match protocol.create_operator() {
            Ok(op) => op,
            Err(_) => return false,
        };

        operator.list("/").await.is_ok()
    }

    #[tokio::test]
    async fn test_basic_operations() {
        if !check_server_available().await {
            println!("跳过集成测试：没有可用的服务器");
            return;
        }

        let config = create_test_config();
        let protocol = FtpProtocol::from_config(&config).unwrap();
        let operator = protocol.create_operator().unwrap();

        // 测试写入
        let test_content = "Hello, World!";
        let test_path = "test_file.txt";
        
        let write_result = operator.write(test_path, test_content).await;
        assert!(write_result.is_ok());

        // 测试读取
        let read_result = operator.read(test_path).await;
        assert!(read_result.is_ok());
        assert_eq!(read_result.unwrap().to_vec(), test_content.as_bytes());

        // 测试删除
        let delete_result = operator.delete(test_path).await;
        assert!(delete_result.is_ok());
    }
}
```

### 6. 创建测试环境脚本

创建 `scripts/setup_[protocol]_test.sh`：

```bash
#!/bin/bash

set -e

echo "正在设置 [协议] 测试环境..."

# 检查Docker是否可用
if ! command -v docker &> /dev/null; then
    echo "错误: 需要安装Docker来运行测试服务器"
    exit 1
fi

# 检测CPU架构并选择合适的Docker镜像
ARCH=$(uname -m)
case $ARCH in
    x86_64)
        IMAGE="适合x86_64的镜像"
        echo "检测到x86_64架构，使用镜像: $IMAGE"
        ;;
    arm64|aarch64)
        IMAGE="适合ARM64的镜像"
        echo "检测到ARM64架构，使用镜像: $IMAGE"
        ;;
    *)
        echo "错误: 不支持的CPU架构: $ARCH"
        exit 1
        ;;
esac

# 启动测试服务器
echo "启动测试服务器..."
docker run --rm -d \
    --name protocol-test-server \
    -p PORT:PORT \
    -e CONFIG=value \
    $IMAGE

# 等待服务器启动
echo "等待服务器启动..."
sleep 5

# 验证服务器状态
if docker ps | grep -q protocol-test-server; then
    echo "✅ 测试服务器已启动"
    echo "现在可以运行集成测试:"
    echo "cargo test protocol_integration_tests"
else
    echo "❌ 测试服务器启动失败"
    exit 1
fi
```

### 7. 更新文档

创建协议特定的测试文档 `tests/[PROTOCOL]_TEST_README.md`，包含：

1. 协议概述
2. 配置参数说明
3. 测试类型和运行方法
4. 功能特性列表
5. 故障排除指南
6. 扩展开发指南

## 配置参数模板

每个协议都应支持以下基本配置模式：

```rust
// 必需参数
config.insert("host".to_string(), "服务器地址".to_string());
config.insert("username".to_string(), "用户名".to_string());
config.insert("password".to_string(), "密码".to_string());

// 可选参数
config.insert("port".to_string(), "端口号".to_string());
config.insert("root".to_string(), "根路径".to_string());

// 协议特定参数
config.insert("protocol_specific_param".to_string(), "值".to_string());
```

## 功能能力配置

根据协议特性设置 `Capabilities`：

```rust
fn get_capabilities(&self) -> Capabilities {
    Capabilities::default()
        .with_list(true)        // 支持列出目录
        .with_read(true)        // 支持读取文件
        .with_write(true)       // 支持写入文件
        .with_delete(true)      // 支持删除文件
        .with_create_dir(true)  // 支持创建目录
        .with_rename(true)      // 支持重命名
        .with_copy(false)       // 是否支持服务器端复制
        .with_batch_delete(false) // 是否支持批量删除
}
```

## 测试运行命令

```bash
# 运行单元测试
cargo test protocols::[protocol] --lib

# 运行集成测试（需要先启动测试服务器）
./scripts/setup_[protocol]_test.sh
cargo test --test [protocol]_integration_tests

# 清理测试环境
./scripts/cleanup_[protocol]_test.sh
```

## 错误处理

确保所有可能的错误都被正确处理：

```rust
// 配置错误
Error::new_config("错误信息")

// 网络错误
Error::from(opendal_error)

// 参数验证错误
Error::new_invalid_argument("参数错误信息")
```

## 调试技巧

1. 启用详细日志：
```bash
RUST_LOG=debug cargo test [protocol]_integration_tests
```

2. 使用调试输出：
```rust
debug!("调试信息: {}", variable);
```

3. 验证配置：
```rust
println!("配置: {:?}", config);
```

## 最佳实践

1. **配置验证**：在 `from_config` 中严格验证所有必需参数
2. **错误处理**：提供清晰的错误信息，帮助用户诊断问题
3. **测试覆盖**：确保单元测试和集成测试覆盖所有功能
4. **文档完整**：提供详细的使用说明和故障排除指南
5. **架构兼容**：确保测试脚本支持多种CPU架构
6. **资源清理**：测试后正确清理临时文件和资源

## 示例：FTP协议实现

参考 FTP 协议的完整实现作为新协议开发的模板：

- `src/protocols/ftp.rs` - 协议实现
- `tests/ftp_integration_tests.rs` - 集成测试
- `scripts/setup_ftp_test.sh` - 测试环境脚本
- `tests/FTP_TEST_README.md` - 测试文档

通过遵循这个指南，可以确保新添加的协议与项目架构保持一致，并具有完整的测试覆盖和文档支持。
