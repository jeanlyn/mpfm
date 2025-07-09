# 快速开始指南

本指南帮助您快速上手多协议文件管理器的开发和使用。

## 环境要求

- Rust 1.70+
- Docker（用于运行测试服务器）
- Git

## 快速开始

### 1. 获取代码

```bash
git clone <repository-url>
cd mpfm
```

### 2. 编译项目

```bash
cargo build
```

### 3. 运行测试

```bash
# 运行所有单元测试
cargo test --lib

# 测试特定协议
cargo test --lib protocols::ftp
```

### 4. 运行集成测试

```bash
# 启动FTP测试服务器
./scripts/setup_ftp_test.sh

# 运行FTP集成测试
cargo test --test ftp_integration_tests

# 清理测试环境
./scripts/cleanup_ftp_test.sh
```

## 使用示例

### 配置FTP连接

```rust
use std::collections::HashMap;
use multi_protocol_file_manager::protocols::create_protocol;

let mut config = HashMap::new();
config.insert("host".to_string(), "ftp.example.com".to_string());
config.insert("username".to_string(), "user".to_string());
config.insert("password".to_string(), "pass".to_string());
config.insert("port".to_string(), "21".to_string());

let protocol = create_protocol("ftp", &config)?;
let operator = protocol.create_operator()?;
```

### 基本文件操作

```rust
// 上传文件
operator.write("remote/file.txt", "Hello, World!").await?;

// 下载文件
let content = operator.read("remote/file.txt").await?;

// 列出目录
let entries = operator.list("/").await?;
for entry in entries {
    println!("{}", entry.name());
}

// 删除文件
operator.delete("remote/file.txt").await?;
```

## 添加新协议

如果您想添加新的协议支持，请参考 [添加新协议指南](ADD_NEW_PROTOCOL.md)。

### 基本步骤

1. 在 `Cargo.toml` 中添加依赖
2. 创建协议实现文件
3. 注册到工厂函数
4. 编写测试
5. 创建测试环境

## 文档结构

```
docs/
├── DEVELOPMENT.md      # 详细开发文档
├── ADD_NEW_PROTOCOL.md # 添加协议指南
└── QUICK_START.md      # 本文档

tests/
└── FTP_TEST_README.md  # FTP测试说明
```

## 常用命令

```bash
# 格式化代码
cargo fmt

# 检查代码
cargo clippy

# 生成文档
cargo doc --open

# 运行示例
cargo run --example ftp_manual_test
```

## 获取帮助

- 查看 [开发文档](DEVELOPMENT.md)
- 查看 [添加协议指南](ADD_NEW_PROTOCOL.md)
- 查看测试文档（如 `tests/FTP_TEST_README.md`）

## 下一步

1. 阅读 [开发文档](DEVELOPMENT.md) 了解项目架构
2. 查看现有协议实现作为参考
3. 尝试添加新的协议支持
4. 贡献代码和文档
