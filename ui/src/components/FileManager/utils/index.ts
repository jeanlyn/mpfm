/**
 * 格式化文件大小
 */
export const formatFileSize = (size?: number): string => {
  if (!size) return '-';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let fileSize = size;
  
  while (fileSize >= 1024 && unitIndex < units.length - 1) {
    fileSize /= 1024;
    unitIndex++;
  }
  
  return `${fileSize.toFixed(1)} ${units[unitIndex]}`;
};

/**
 * 计算表格高度
 */
export const calculateTableHeight = (reservedHeight: number, minHeight: number, maxHeight: number): number => {
  const windowHeight = window.innerHeight;
  const availableHeight = Math.min(maxHeight, Math.max(minHeight, windowHeight - reservedHeight));
  return availableHeight;
};

/**
 * 从文件路径中提取文件名
 */
export const extractFileName = (path: string): string => {
  return path.split('/').pop() || path;
};

/**
 * 格式化修改时间
 */
export const formatModifiedTime = (modified: string | undefined): string => {
  if (!modified) return '-';
  
  return new Date(modified).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};