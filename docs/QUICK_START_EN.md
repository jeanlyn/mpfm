# Quick Start Guide

Multi-Protocol File Manager is a cross-platform application built with Rust and Tauri that provides unified access to different storage protocols through OpenDAL.

## Features

- **Multiple Protocol Support**: File System, S3, FTP, and more
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Modern UI**: Built with React and TypeScript
- **High Performance**: Rust backend with efficient file operations
- **Extensible**: Easy to add new protocol support

## Currently Supported Protocols

- **File System (fs)**: Local file system access
- **Amazon S3 (s3)**: S3-compatible object storage
- **FTP (ftp)**: File Transfer Protocol support

## Installation

### Prerequisites

- **Rust** (latest stable version)
- **Node.js** (v16 or later)
- **pnpm** (for frontend dependencies)

### Build from Source

1. Clone the repository:
```bash
git clone <repository-url>
cd mpfm
```

2. Install dependencies:
```bash
# Install Rust dependencies
cargo build

# Install frontend dependencies
cd ui
pnpm install
cd ..
```

3. Build the application:
```bash
cargo build --release
```

4. Run the application:
```bash
cargo run
```

## Configuration

### File System Protocol

```rust
let mut config = HashMap::new();
config.insert("root".to_string(), "/path/to/directory".to_string());
let protocol = create_protocol("fs", &config)?;
```

### S3 Protocol

```rust
let mut config = HashMap::new();
config.insert("bucket".to_string(), "my-bucket".to_string());
config.insert("region".to_string(), "us-east-1".to_string());
config.insert("access_key".to_string(), "your-access-key".to_string());
config.insert("secret_key".to_string(), "your-secret-key".to_string());
let protocol = create_protocol("s3", &config)?;
```

### FTP Protocol

```rust
let mut config = HashMap::new();
config.insert("host".to_string(), "ftp.example.com".to_string());
config.insert("port".to_string(), "21".to_string());
config.insert("username".to_string(), "user".to_string());
config.insert("password".to_string(), "password".to_string());
let protocol = create_protocol("ftp", &config)?;
```

## Development

### Adding New Protocols

See [Adding New Protocol Guide](ADDING_NEW_PROTOCOL_EN.md) for detailed instructions.

### Testing

```bash
# Run all tests
cargo test

# Run specific protocol tests
cargo test protocols::ftp

# Run with test environment (for FTP)
./scripts/setup_ftp_test.sh
cargo test --test ftp_integration_tests
./scripts/cleanup_ftp_test.sh
```

### Frontend Development

```bash
cd ui
pnpm dev
```

## Architecture

- **Backend**: Rust with OpenDAL for protocol abstraction
- **Frontend**: React + TypeScript with Vite
- **Bridge**: Tauri for native integration
- **Storage**: Protocol-agnostic through OpenDAL

## Roadmap

- [ ] Additional protocol support (SFTP, WebDAV, etc.)
- [ ] Advanced file operations (sync, backup)
- [ ] Plugin system
- [ ] Cloud service integrations
- [ ] Mobile support

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Create an issue in the repository
- Check the documentation in the `docs/` directory
- Review existing issues and discussions
