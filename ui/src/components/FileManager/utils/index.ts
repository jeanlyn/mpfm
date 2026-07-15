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

/** 检测当前是否为 Windows 操作系统 */
const detectIsWindows = (): boolean =>
  navigator.userAgent.includes('Windows') ||
  navigator.platform.toLowerCase().startsWith('win');

/** 按操作系统分隔符从本地路径提取文件名（非 Tauri 环境回退） */
const extractLocalFileNameSync = (path: string): string => {
  const separator = detectIsWindows() ? '\\' : '/';
  const lastSep = path.lastIndexOf(separator);
  if (lastSep === -1) return path;
  const name = path.slice(lastSep + 1);
  return name || path;
};

/**
 * 从本地文件系统路径提取文件名（Tauri 下由 Rust 按 OS 解析，浏览器环境按 OS 回退）
 */
export const extractLocalFileName = async (path: string): Promise<string> => {
  try {
    const { basename } = await import('@tauri-apps/api/path');
    return await basename(path);
  } catch {
    return extractLocalFileNameSync(path);
  }
};

/** 从远程路径提取文件名（SFTP/FTP/S3 等协议统一使用 `/`） */
export const extractRemoteFileName = (path: string): string => {
  const lastSep = path.lastIndexOf('/');
  if (lastSep === -1) return path;
  const name = path.slice(lastSep + 1);
  return name || path;
};

/** 将远程路径规范化为带尾部斜杠的目录前缀 */
export const normalizeRemoteDirPrefix = (path: string): string => {
  let normalized = path.startsWith('/') ? path.slice(1) : path;
  if (!normalized) return '';
  if (!normalized.endsWith('/')) normalized += '/';
  return normalized;
};

/** 判断目录条目是否为当前路径的自引用 folder marker */
export const isSelfReferentialDirEntry = (file: { path: string; is_dir: boolean }, currentPath: string): boolean => {
  if (!file.is_dir) return false;
  const currentPrefix = normalizeRemoteDirPrefix(currentPath);
  if (!currentPrefix) return false;
  return normalizeRemoteDirPrefix(file.path) === currentPrefix;
};

/** @deprecated 请使用 extractLocalFileName 或 extractRemoteFileName */
export const extractFileName = extractRemoteFileName;

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