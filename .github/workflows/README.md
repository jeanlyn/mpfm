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
- 统一使用 `Node 20 + pnpm/action-setup + packageManager`
- `full-tests` 直接复用 `bash ./scripts/check.sh`
- PR 不使用路径过滤，保证每个面向 `master` / `develop` 的 PR 都会生成必需检查
- 同一 PR 或分支的新提交会取消旧 CI，避免重复消耗 runner 时间
- `CI Gate` 汇总 `Basic Checks`、`Full Tests` 和 `Windows Release Script Tests`；任一任务失败、取消或跳过都会使门禁失败

### 个人项目推荐的 `master` 保护

在 GitHub 仓库中创建名为 `master-pr-ci` 的 active branch ruleset，并设置：

- 目标分支：`master`
- 要求通过 Pull Request 合并，但 required approvals 设为 `0`
- 要求状态检查 `CI Gate` 成功，并要求分支在合并前更新到最新 `master`
- 禁止 force push 和删除分支
- 为 Repository administrator 保留 bypass，作为紧急恢复通道

先让包含本配置的 PR 成功运行一次，确保 GitHub 已记录 `CI Gate` 检查名称，再把它设为 required status check。日常合并不使用 bypass；本地 pre-push hook 只负责提前反馈，不能替代远端门禁。

### 2. 正式发布 (`release.yml`)

**触发条件：**
- 推送 `v*` tag，例如 `v0.2.4`
- 手动 `workflow_dispatch`，并指定已有 tag

**用途：**
- 构建并发布桌面端安装包到同一个 GitHub Draft Release
- 附加 `main_cli` 的跨平台压缩包
- 同时附加包含 fixed WebView2 Runtime 的 Windows 特别版

**当前产物覆盖：**
- macOS Apple Silicon `dmg`
- macOS Intel `dmg`
- Linux 桌面包
- Windows 默认安装包（x64，在线引导 WebView2）
- Windows fixed WebView2 安装包（x64 + arm64，各含 `.msi` 与 `-setup.exe`）
- CLI:
  - `x86_64-unknown-linux-musl`
  - `aarch64-unknown-linux-musl`
  - `x86_64-apple-darwin`
  - `aarch64-apple-darwin`
  - `x86_64-pc-windows-msvc`
  - `aarch64-pc-windows-msvc`

**制品命名：**

所有面向用户下载的 GitHub Release 应用制品统一使用 `mpfm-v{version}-{type}-{os}-{arch}[-{variant}].{extension}`。其中操作系统固定为 `macos`、`linux`、`windows`，架构固定为 `x86_64`、`aarch64`。例如：

- `mpfm-v0.3.1-desktop-macos-aarch64.dmg`
- `mpfm-v0.3.1-desktop-linux-x86_64.AppImage`
- `mpfm-v0.3.1-cli-windows-x86_64.zip`

该规则只改变 GitHub Release 的下载文件名，不改变安装后的应用名称或 CLI 压缩包内的可执行文件名。Tauri updater 元数据 `latest.json` 保留固定名称，不属于应用安装制品。

**保护措施：**
- 发布前执行 `bash ./scripts/release-version.sh --expect-tag <tag>`
- 校验 `Cargo.toml`、`package.json`、`ui/package.json`、`tauri.conf.json`、`tauri.win.conf.json` 的版本完全一致
- 发布时根据当前 `v*` tag 与上一个 `v*` tag 之间的 Conventional Commit 自动生成分组 Release Notes，并自动附带安装 FAQ
- macOS runner 默认发布 `dmg` 安装包，避免用户下载到 `.app.tar.gz` 后还需要手动解压和移动应用

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

## FAQ

### macOS 安装时报错怎么办？

如果打开 DMG 中的应用时看到“无法验证开发者”“已损坏，无法打开”或类似 Gatekeeper 提示：

1. 确认安装包来自本仓库 GitHub Release 页面。
2. 先尝试在“系统设置 > 隐私与安全性”中点击“仍要打开”。
3. 如果仍然打不开，可以对已拖到 Applications 的应用执行：

```bash
xattr -dr com.apple.quarantine /Applications/mpfm.app
```

然后重新打开应用。

### 发版后 Release Notes 会自动更新吗？

会。`release.yml` 会根据当前 `v*` tag 和上一个 `v*` tag 之间的 Conventional Commit 自动生成分组 Release Notes，附带安装 FAQ，并写回同一个 Draft Release。

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
./scripts/release-notes.sh --tag v0.2.4 --repo-url https://github.com/jeanlyn/mpfm
pnpm run release -- 0.2.4  # 一键发版
```
