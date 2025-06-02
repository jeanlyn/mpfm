# TabbedFileManager 组件

这是一个模块化的Tab式文件管理器系统，支持同时打开多个连接的文件管理器，并确保同一连接不会重复打开。

## 功能特性

- **Tab管理**: 支持打开、关闭、切换多个文件管理器Tab
- **防重复打开**: 同一个连接只会打开一个Tab，点击已打开的连接会切换到对应Tab
- **右键菜单**: 每个Tab都支持右键菜单，可以关闭当前Tab、关闭其他Tab、关闭所有Tab
- **模块化设计**: 代码结构清晰，易于维护和扩展

## 组件结构

```
TabbedFileManager/
├── index.tsx                  # 主组件
├── types.ts                   # 类型定义
├── export.ts                  # 导出文件
├── hooks/
│   └── useTabManager.ts       # Tab管理Hook
└── components/
    ├── TabBar.tsx             # Tab栏组件
    └── FileManagerTab.tsx     # 单个Tab内容组件
```

## 使用方法

```tsx
import TabbedFileManager from './components/TabbedFileManager';

// 在App组件中使用
<TabbedFileManager selectedConnection={currentConnection} />
```

## API

### TabbedFileManager Props

- `selectedConnection: Connection | null` - 当前选中的连接

### useTabManager Hook

提供了完整的Tab管理功能：

- `openTab(connection)` - 打开或切换到指定连接的Tab
- `closeTab(tabId)` - 关闭指定Tab
- `switchToTab(tabId)` - 切换到指定Tab
- `closeAllTabs()` - 关闭所有Tab
- `closeOtherTabs(keepTabId)` - 关闭除指定Tab外的所有Tab
- `getActiveTab()` - 获取当前活跃的Tab
- `isTabOpen(connectionId)` - 检查连接是否已打开

## 特性说明

1. **智能Tab切换**: 当点击已打开的连接时，会自动切换到对应的Tab而不是创建新Tab
2. **Tab关闭逻辑**: 关闭当前活跃Tab时，会自动切换到最后一个Tab
3. **内存优化**: 使用CSS控制Tab内容的显示/隐藏，避免频繁的组件卸载/挂载
4. **用户体验**: 提供丰富的右键菜单和快捷操作
