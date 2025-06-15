// FileManager 相关常量定义

export const PAGE_SIZES = [25, 50, 100, 200] as const;

export const DEFAULT_PAGE_SIZE = 50;

export const DEFAULT_TABLE_HEIGHT = 400;

export const PAGINATION_MODE_THRESHOLD = 100;

// 在Tab环境中预留空间的高度计算
// Tab栏(48px) + 内容padding(48px) + 工具栏(48px) + 面包屑(32px) + 分页(80px) + 表格与分页间距(16px) + 其他边距(20px)
export const RESERVED_HEIGHT = 252;

export const MIN_TABLE_HEIGHT = 200;
export const MAX_TABLE_HEIGHT = 650;

// 操作按钮宽度
export const ACTION_BUTTON_WIDTH = 76;

// 列宽定义
export const COLUMN_WIDTHS = {
  select: 50,
  name: '35%',
  size: 120,
  modified: 180,
  actions: 240,
} as const;
