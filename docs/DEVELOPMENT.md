# 多协议文件管理器 - 开发文档

## 项目概述

多协议文件管理器是一个基于 Rust 和 OpenDAL 构建的跨平台文件管理工具，支持多种存储协议，包括本地文件系统、S3、FTP 等。

## 架构设计

### 核心模块

```
src/
├── core/           # 核心功能模块
│   ├── config.rs   # 配置管理
│   ├── error.rs    # 错误处理
│   └── file.rs     # 文件操作抽象
├── protocols/      # 协议实现模块
│   ├── mod.rs      # 协议工厂和公共接口
│   ├── traits.rs   # 协议特征定义
│   ├── fs.rs       # 文件系统协议
│   ├── s3.rs       # S3协议
│   └── ftp.rs      # FTP协议
├── commands/       # 命令行命令实现
│   ├── mod.rs
│   ├── config.rs
│   ├── connection.rs
│   ├── file.rs
│   ├── types.rs
│   └── utils.rs
├── cli/            # 命令行界面
│   ├── mod.rs
│   ├── app.rs
│   └── commands.rs
└── utils/          # 工具函数
    └── mod.rs
```

### 协议架构

协议系统采用工厂模式和特征（Trait）设计：

1. **Protocol Trait**：定义所有协议的通用接口
2. **协议实现**：每个协议实现 Protocol trait
3. **工厂函数**：根据协议类型创建相应的协议实例
4. **能力描述**：每个协议声明自己支持的功能

### 数据流

```
用户请求 → CLI解析 → 命令处理 → 协议选择 → OpenDAL操作 → 结果返回
```

## 支持的协议

### 当前支持

| 协议 | 状态 | 功能 | 测试 |
|------|------|------|------|
| 文件系统 (fs) | ✅ 完成 | 完整 | ✅ |
| S3 | ✅ 完成 | 完整 | ✅ |
| FTP | ✅ 完成 | 完整 | ✅ |

### 计划支持

- SFTP
- WebDAV
- OneDrive
- Google Drive
- Dropbox

## 开发指南

### 添加新协议

详见 [添加新协议指南](ADD_NEW_PROTOCOL.md)

### 项目结构约定

1. **协议实现**：每个协议一个文件，位于 `src/protocols/`
2. **测试文件**：集成测试位于 `tests/`，单元测试在对应源文件中
3. **测试脚本**：测试环境脚本位于 `scripts/`
4. **文档**：协议文档位于 `tests/` 或 `docs/`

### 代码规范

1. **错误处理**：使用项目定义的 `Error` 类型
2. **日志记录**：使用 `log` crate，适当级别记录
3. **配置管理**：通过 `HashMap<String, String>` 传递配置
4. **测试覆盖**：确保单元测试和集成测试覆盖

### 依赖管理

核心依赖：
- `opendal`：存储操作抽象层
- `tokio`：异步运行时
- `clap`：命令行解析
- `serde`：序列化/反序列化
- `log`：日志记录

开发依赖：
- `tempfile`：临时文件测试

## 测试策略

### 测试层次

1. **单元测试**：测试单个函数和方法
2. **集成测试**：测试协议完整功能
3. **端到端测试**：测试完整用户场景

### 测试环境

使用 Docker 容器提供测试服务器：
- 支持多架构（x86_64, ARM64）
- 自动化设置和清理
- 隔离的测试环境

### 运行测试

```bash
# 所有单元测试
cargo test --lib

# 特定协议单元测试
cargo test --lib protocols::ftp

# 集成测试（需要先启动测试服务器）
./scripts/setup_ftp_test.sh
cargo test --test ftp_integration_tests
./scripts/cleanup_ftp_test.sh

# 性能测试
cargo test performance_tests
```

## 配置系统

### 配置文件格式

```json
{
  "connections": [
    {
      "name": "my-ftp",
      "type": "ftp",
      "config": {
        "host": "ftp.example.com",
        "username": "user",
        "password": "pass",
        "port": "21"
      }
    }
  ]
}
```

### 环境变量

支持通过环境变量覆盖配置：
- `MPFM_CONFIG_PATH`：配置文件路径
- `RUST_LOG`：日志级别

## 构建和部署

### 本地开发

```bash
# 克隆仓库
git clone <repository>
cd mpfm

# 安装依赖
cargo build

# 运行测试
cargo test

# 启动开发服务器
cargo run
```

### 发布构建

```bash
# 优化构建
cargo build --release

# 跨平台构建
cargo build --target x86_64-unknown-linux-gnu
cargo build --target aarch64-unknown-linux-gnu
```

### Docker 部署

```dockerfile
FROM rust:1.70 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bullseye-slim
RUN apt-get update && apt-get install -y ca-certificates
COPY --from=builder /app/target/release/multi-protocol-file-manager /usr/local/bin/
CMD ["multi-protocol-file-manager"]
```

## 性能优化

### 编译优化

`Cargo.toml` 中的优化设置：
```toml
[profile.release]
lto = true
codegen-units = 1
opt-level = 3
strip = true
```

### 运行时优化

1. **连接池**：复用网络连接
2. **缓存**：缓存目录列表和元数据
3. **并发**：并行处理多个文件操作
4. **流式传输**：大文件流式处理

## 监控和调试

### 日志记录

使用结构化日志：
```rust
debug!("创建协议操作符: protocol={}, host={}", protocol_type, host);
info!("文件传输完成: {} bytes", size);
warn!("连接超时，正在重试...");
error!("协议初始化失败: {}", error);
```

### 性能监控

- 连接建立时间
- 文件传输速度
- 错误率统计
- 内存使用情况

### 调试工具

```bash
# 详细日志
RUST_LOG=debug cargo run

# 性能分析
cargo flamegraph --bin multi-protocol-file-manager

# 内存分析
valgrind --tool=memcheck ./target/release/multi-protocol-file-manager
```

## 贡献指南

### 代码提交

1. Fork 项目
2. 创建功能分支：`git checkout -b feature/new-protocol`
3. 提交变更：`git commit -am 'Add new protocol support'`
4. 推送分支：`git push origin feature/new-protocol`
5. 创建 Pull Request

### 代码审查

Pull Request 需要通过：
- 所有测试
- 代码格式检查
- 安全审查
- 功能审查

### 发布流程

1. 更新版本号
2. 更新 CHANGELOG
3. 创建 Git 标签
4. 构建发布包
5. 发布到包管理器

## 故障排除

### 常见问题

1. **编译错误**：检查 Rust 版本和依赖
2. **测试失败**：确认测试服务器状态
3. **连接问题**：检查网络和认证
4. **性能问题**：启用详细日志分析

### 获取帮助

- 查看文档：`docs/` 目录
- 查看示例：`examples/` 目录
- 提交 Issue：GitHub Issues
- 讨论：GitHub Discussions

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](../LICENSE) 文件。
