# GitHub Actions CI/CD 配置

本项目配置了多个 GitHub Actions 工作流程来确保代码质量和自动化测试。

## 工作流程说明

### 1. CI Pipeline (`ci.yml`)
**触发条件：** 
- 所有分支的提交（排除文档变更）
- 向 master/develop 分支的 PR

**用途：** 
- **basic-checks**: 为所有分支运行基本编译和类型检查
- **full-tests**: 仅为主要分支和 PR 运行完整测试套件

**包含内容：**
- Rust 编译检查
- TypeScript 类型检查  
- 代码格式检查 (cargo fmt)
- 静态分析 (cargo clippy)
- 完整测试套件
- 前端构建

### 2. 测试套件 (`tests.yml`)
**触发条件：** master/develop 分支的源码变更
**用途：** 深度测试和安全审计

**包含内容：**
- Rust 单元测试
- Rust 集成测试
- 文档测试
- 前端测试
- 安全漏洞审计（仅主分支）

### 3. 发布流程 (`release.yml`, `release-win.yml`)
**触发条件：** release 分支或手动触发
**用途：** 构建和发布应用程序

## 避免重复执行的设计

为了解决测试重复运行的问题，我们采用了以下策略：

1. **分层检查**：
   - 所有分支：基本编译和类型检查
   - 主要分支/PR：完整测试套件
   - 源码变更：深度测试

2. **条件执行**：
   - 使用 `if` 条件控制 job 执行
   - 基于分支名称和事件类型进行过滤
   - 使用 `paths` 过滤器只在相关文件变更时运行

3. **路径过滤**：
   - 排除文档变更触发 CI
   - 只在源码变更时运行测试

## 测试策略

### Rust 后端测试
```bash
# 运行所有 Rust 测试（不会重复）
cargo test --verbose

# 运行特定类型的测试
cargo test --lib              # 库测试
cargo test --test '*'         # 集成测试  
cargo test --doc              # 文档测试

# 代码质量检查
cargo fmt --check
cargo clippy
```

### 前端测试
```bash
cd ui
pnpm run type-check    # TypeScript 检查
pnpm run build         # 构建验证
```

## 分支策略和触发规则

| 分支类型 | 触发的 Workflow | 运行的测试 |
|---------|----------------|-----------|
| feature/* | ci.yml (basic-checks) | 编译检查 + 类型检查 |
| master/develop | ci.yml (full-tests) + tests.yml | 完整测试套件 |
| PR to master/develop | ci.yml (full-tests) + tests.yml | 完整测试套件 |
| release | release.yml | 构建和发布 |

## 解决重复测试的方法

之前的问题是多个 workflow 文件在相同条件下都会执行测试，导致：
- `ci.yml`, `unit-tests.yml`, `test.yml` 同时运行
- 相同的测试命令被执行多次

**解决方案：**
1. 合并重复的 workflow
2. 使用条件语句控制执行
3. 明确各 workflow 的职责分工
4. 使用路径和分支过滤器

## 贡献指南

1. **功能分支**：自动运行基本检查，快速反馈
2. **PR 到主分支**：运行完整测试套件
3. **主分支合并**：运行完整测试 + 安全审计
4. **发布**：构建跨平台应用

这样的设计确保了：
- ✅ 不会重复运行相同的测试
- ✅ 快速反馈开发者
- ✅ 主分支质量保证
- ✅ 资源使用优化
