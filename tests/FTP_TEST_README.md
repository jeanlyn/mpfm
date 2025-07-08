# FTP协议支持测试指南

本文档说明如何测试新增的FTP协议支持功能。

## 概述

本项目通过OpenDAL库新增了FTP协议支持，包含以下功能：
- FTP服务器连接和认证
- 文件上传和下载
- 目录操作（创建、列出、删除）
- 文件重命名和删除

## 测试类型

### 1. 单元测试

单元测试不需要真实的FTP服务器，主要测试配置解析和基本功能：

```bash
# 运行FTP协议相关的单元测试
cargo test protocols::ftp
```

### 2. 集成测试

集成测试需要一个真实的FTP服务器。我们提供了Docker方式来快速设置测试环境。

#### 设置测试环境

1. 确保安装了Docker
2. 运行设置脚本：

```bash
./scripts/setup_ftp_test.sh
```

这将根据当前系统的CPU架构自动选择合适的Docker镜像启动FTP测试服务器：
- **x86_64**: 使用 `delfer/alpine-ftp-server`
- **ARM64/AArch64**: 使用 `delfer/alpine-ftp-server` (支持多架构)

测试服务器配置：
- 主机: 127.0.0.1
- 端口: 2121
- 用户名: testuser
- 密码: testpass
- 根目录: /ftp

服务器配置如下：
- 主机: 127.0.0.1
- 端口: 2121
- 用户名: testuser
- 密码: testpass

#### 运行集成测试

```bash
# 运行所有FTP集成测试
cargo test ftp_integration_tests

# 运行特定的集成测试
cargo test test_ftp_basic_operations
cargo test test_ftp_directory_operations
cargo test test_ftp_large_file_operations
```

#### 清理测试环境

测试完成后，清理测试环境：

```bash
./scripts/cleanup_ftp_test.sh
```

### 3. 性能测试

性能测试评估FTP协议的连接时间和操作效率：

```bash
cargo test performance_tests
```

## FTP配置参数

FTP协议支持以下配置参数：

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| host | string | 是 | - | FTP服务器地址 |
| port | number | 否 | 21 | FTP服务器端口 |
| username | string | 是 | - | 用户名 |
| password | string | 是 | - | 密码 |
| root | string | 否 | "/" | 根目录路径 |

### 配置示例

```rust
use std::collections::HashMap;

let mut config = HashMap::new();
config.insert("host".to_string(), "ftp.example.com".to_string());
config.insert("port".to_string(), "21".to_string());
config.insert("username".to_string(), "myuser".to_string());
config.insert("password".to_string(), "mypassword".to_string());
config.insert("root".to_string(), "/upload".to_string());

let protocol = create_protocol("ftp", &config)?;
```

## 功能特性

FTP协议实现支持以下操作：

- ✅ 列出目录内容 (`can_list`)
- ✅ 读取文件 (`can_read`)
- ✅ 写入文件 (`can_write`)
- ✅ 删除文件 (`can_delete`)
- ✅ 创建目录 (`can_create_dir`)
- ✅ 重命名文件 (`can_rename`)
- ❌ 服务器端复制 (`can_copy`) - FTP协议限制
- ❌ 批量删除 (`can_batch_delete`) - FTP协议限制

## 故障排除

### 常见问题

1. **连接超时**
   - 检查网络连接
   - 确认FTP服务器地址和端口正确
   - 检查防火墙设置

2. **认证失败**
   - 验证用户名和密码
   - 确认用户有相应权限

3. **权限错误**
   - 检查用户对目标目录的读写权限
   - 确认root路径设置正确

### 调试技巧

启用日志来查看详细的调试信息：

```bash
RUST_LOG=debug cargo test ftp_integration_tests
```

## 扩展开发

如需添加新的FTP功能或修改现有实现，请参考：

1. `src/protocols/ftp.rs` - FTP协议实现
2. `tests/ftp_integration_tests.rs` - 集成测试
3. `src/protocols/mod.rs` - 协议工厂函数

添加新功能时，请确保：
1. 实现相应的单元测试
2. 添加集成测试验证功能
3. 更新文档和配置说明
