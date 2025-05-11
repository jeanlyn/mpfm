# OpenDAL 多协议文件管理客户端

基于 [Apache OpenDAL™](https://opendal.apache.org/) 的跨平台多协议文件管理客户端，支持多种存储服务和协议。

## 功能特点

- 支持 Windows、Linux 和 macOS 多种操作系统
- 支持多种存储协议，首先实现了 S3 协议支持
- 支持客户端连接信息的管理
- 可扩展架构，支持通过插件方式添加更多协议
- 实现基础文件操作：列表/上传/下载/删除等功能

## 快速开始

### 编译

```bash
# 克隆代码
git clone https://github.com/yourusername/multi-protocol-file-manager.git
cd multi-protocol-file-manager

# 编译项目
cargo build --release
```

### 使用示例

1. 添加 S3 连接

```bash
./mpfm connection add --name "我的S3" --type s3 --config '{"bucket":"my-bucket","region":"us-east-1","endpoint":"https://s3.amazonaws.com","access_key":"YOUR_ACCESS_KEY","secret_key":"YOUR_SECRET_KEY"}'
```

2. 列出连接

```bash
./mpfm connection list
```

3. 列出文件

```bash
./mpfm ls --connection <connection-id> /some/path
```

4. 上传文件

```bash
./mpfm upload --connection <connection-id> local_file.txt /remote/path/file.txt
```

5. 下载文件

```bash
./mpfm download --connection <connection-id> /remote/path/file.txt local_download.txt
```

6. 删除文件

```bash
./mpfm rm --connection <connection-id> /remote/path/file.txt
```

7. 创建目录

```bash
./mpfm mkdir --connection <connection-id> /remote/path/new-dir
```

## 支持的协议

目前支持的协议：

- S3 兼容存储 (AWS S3, MinIO, Ceph)

计划支持的协议：

- 本地文件系统
- SFTP
- WebDAV
- FTP
- Azure Blob Storage
- Google Cloud Storage
- 更多...

## 项目结构

```
multi-protocol-file-manager/
├── src/
│   ├── cli/            # 命令行界面
│   ├── core/           # 核心功能模块
│   ├── protocols/      # 协议适配器
│   └── utils/          # 工具函数
└── README.md
```

## 贡献指南

欢迎贡献代码、报告问题或提出改进建议。请遵循以下步骤：

1. Fork 仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 致谢

- [Apache OpenDAL™](https://opendal.apache.org/) - 提供底层存储访问能力