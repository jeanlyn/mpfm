# GitHub Actions CI/CD 配置

本项目现在采用单一的 `tag-first` 发版方式：日常提交走 `ci.yml`，正式发版通过推送 `v*` tag 触发 [release.yml](/Users/jeanlyn/code/wlb/mpfm/.github/workflows/release.yml)，在同一个 Draft Release 中同时产出桌面端、CLI 和 fixed WebView2 Windows 包。

## 工作流程说明

### 1. CI Pipeline (`ci.yml`)

**触发条件：**
- 所有分支的提交（排除文档变更）
- 向 `master` / `develop` 分支发起的 PR

**用途：**
- `basic-checks`：快速检查 Rust 格式、后端编译、前端类型检查和前端构建
- `full-tests`：仅在 `master` / `develop` 和 PR 上执行共享检查、完整构建与测试

**特点：**
- 统一通过 `bash ./scripts/bootstrap.sh` 安装 root 与 `ui/` 依赖
- 统一使用 `Node 20 + corepack + packageManager`
- `full-tests` 直接复用 `bash ./scripts/check.sh`

### 2. 正式发布 (`release.yml`)

**触发条件：**
- 推送 `v*` tag，例如 `v0.2.4`
- 手动 `workflow_dispatch`，并指定已有 tag

**用途：**
- 构建并发布桌面端安装包到同一个 GitHub Draft Release
- 附加 `main_cli` 的跨平台压缩包
- 同时附加包含 fixed WebView2 Runtime 的 Windows 特别版

**当前产物覆盖：**
- macOS Apple Silicon `app`
- macOS Intel `app`
- Linux 桌面包
- Windows 默认安装包
- Windows fixed WebView2 安装包
- CLI:
  - `x86_64-unknown-linux-musl`
  - `aarch64-unknown-linux-musl`
  - `x86_64-apple-darwin`
  - `aarch64-apple-darwin`
  - `x86_64-pc-windows-msvc`
  - `aarch64-pc-windows-msvc`

**保护措施：**
- 发布前执行 `bash ./scripts/release-version.sh --expect-tag <tag>`
- 校验 `Cargo.toml`、`package.json`、`ui/package.json`、`tauri.conf.json`、`tauri.win.conf.json` 的版本完全一致
- macOS runner 默认发布 `app` bundle，避免无头环境依赖 Finder/AppleScript 生成 DMG 时失败

## 推荐发版方式

一键自动发版：

```bash
pnpm run release -- 0.2.4
```

它会自动完成：
- 更新版本号
- 本地校验和构建
- 提交 release commit
- 推送 `master`
- 创建并推送 `v0.2.4` tag

想先演练但不真正 push/tag：

```bash
pnpm run release -- --dry-run 0.2.4
```

## 本地脚本入口

```bash
pnpm run bootstrap         # 安装 root/ui 依赖
pnpm run check             # Rust + 前端统一检查
pnpm run fix               # Rust 格式化与 clippy 自动修复
pnpm run set:version -- 0.2.4
pnpm run build:ui          # 构建前端
pnpm run build:cli         # 构建 CLI
pnpm run build:desktop     # 构建桌面端
pnpm run build:release     # 发版前一键检查 + 测试 + 构建
pnpm run release:version   # 检查版本元数据是否一致
pnpm run release -- 0.2.4  # 一键发版
```
