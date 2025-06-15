# FileManager 组件模块化结构

这是一个完全模块化的文件管理器组件，将原来的 900+ 行代码拆分为更小的、可维护的模块。

## 目录结构

```
FileManager/
├── index.tsx                    # 主入口文件
├── FileManager.tsx              # 原始的大文件（保留兼容性）
├── FileManagerModular.tsx       # 新的模块化版本
├── types.ts                     # 类型定义
├── constants.ts                 # 常量定义
├── hooks/                       # 自定义 Hooks
│   ├── index.ts                 # Hooks 导出
│   ├── useFileManagerState.ts   # 状态管理 Hook
│   ├── useFileOperations.ts     # 文件操作 Hook
│   ├── useSearchAndPagination.ts # 搜索和分页 Hook
│   ├── usePreviewAndBatch.ts    # 预览和批量操作 Hook
│   ├── useTableHeight.ts        # 表格高度计算 Hook
│   ├── useFileSelection.ts      # 文件选择 Hook（从原位置移动）
│   └── useBatchOperations.ts    # 批量操作 Hook（已合并到其他 Hook）
├── components/                  # 子组件
│   ├── index.ts                 # 组件导出
│   ├── Toolbar.tsx              # 工具栏组件
│   ├── BreadcrumbNav.tsx        # 面包屑导航组件
│   ├── PaginationControls.tsx   # 分页控件组件
│   ├── TableColumns.tsx         # 表格列定义组件
│   ├── BatchOperationToolbar.tsx # 批量操作工具栏（现有）
│   └── BatchDownloadModal.tsx   # 批量下载模态框（现有）
└── utils/                       # 工具函数
    └── index.ts                 # 格式化、计算等工具函数
```

## 模块说明

### 1. Hooks

- **useFileManagerState**: 管理 FileManager 的所有状态，提供统一的状态更新接口
- **useFileOperations**: 处理文件相关操作（上传、下载、删除、创建目录等）
- **useSearchAndPagination**: 处理搜索和分页逻辑
- **usePreviewAndBatch**: 处理文件预览和批量下载功能
- **useTableHeight**: 动态计算表格高度
- **useFileSelection**: 文件选择状态管理

### 2. Components

- **Toolbar**: 顶部工具栏，包含导航按钮、搜索框、操作按钮
- **BreadcrumbNav**: 面包屑导航组件
- **PaginationControls**: 分页控件，支持页面大小选择
- **TableColumns**: 表格列定义，使用 Hook 返回列配置
- **BatchOperationToolbar**: 批量操作工具栏
- **BatchDownloadModal**: 批量下载进度对话框

### 3. Utils

- **formatFileSize**: 格式化文件大小
- **calculateTableHeight**: 计算表格高度
- **extractFileName**: 从路径提取文件名
- **formatModifiedTime**: 格式化修改时间

### 4. Constants

定义了所有常量，如分页大小选项、表格高度限制、列宽等。

### 5. Types

定义了 FileManager 相关的所有 TypeScript 类型。

## 使用方式

### 使用新的模块化版本

```tsx
import FileManagerModular from './components/FileManager/FileManagerModular';

// 在 App 中使用
<FileManagerModular connection={selectedConnection} />
```

### 使用原版本（向后兼容）

```tsx
import FileManager from './components/FileManager/FileManager';

// 在 App 中使用
<FileManager connection={selectedConnection} />
```

## 优势

1. **模块化**: 每个模块专注于特定功能，职责清晰
2. **可维护性**: 小文件更容易理解和修改
3. **可测试性**: 独立的 Hooks 和组件更容易单元测试
4. **可复用性**: Hooks 和组件可以在其他地方复用
5. **TypeScript 支持**: 更好的类型推导和错误检查
6. **性能优化**: 更细粒度的重新渲染控制

## 注意事项

- 新版本保持了与原版本相同的 API 和功能
- 所有现有功能都已迁移到对应的模块中
- 保留了原有的样式和用户体验
- 国际化支持保持不变
