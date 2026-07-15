export type FileType = 
  | 'text' 
  | 'json' 
  | 'code' 
  | 'image' 
  | 'pdf' 
  | 'excel' 
  | 'word'
  | 'unknown';

// 文件扩展名映射
const FILE_TYPE_MAP: Record<string, FileType> = {
  // 文本文件
  '.txt': 'text',
  '.md': 'text',
  '.log': 'text',
  '.xml': 'text',
  '.readme': 'text',
  '.ftl': 'text',
  
  // JSON文件
  '.json': 'json',
  '.jsonl': 'json',
  '.geojson': 'json',
  // JSONC 允许注释，不能交给基于 JSON.parse 的 JSON 预览器。
  '.jsonc': 'code',
  
  // 代码文件
  '.js': 'code',
  '.jsx': 'code',
  '.ts': 'code',
  '.tsx': 'code',
  '.vue': 'code',
  '.py': 'code',
  '.java': 'code',
  '.c': 'code',
  '.cpp': 'code',
  '.h': 'code',
  '.hpp': 'code',
  '.cs': 'code',
  '.php': 'code',
  '.rb': 'code',
  '.go': 'code',
  '.rs': 'code',
  '.swift': 'code',
  '.kt': 'code',
  '.scala': 'code',
  '.html': 'code',
  '.htm': 'code',
  '.css': 'code',
  '.scss': 'code',
  '.sass': 'code',
  '.less': 'code',
  '.sql': 'code',
  '.sh': 'code',
  '.bash': 'code',
  '.ps1': 'code',
  '.bat': 'code',
  '.yaml': 'code',
  '.yml': 'code',
  '.toml': 'code',
  '.ini': 'code',
  '.conf': 'code',
  '.dockerfile': 'code',
  
  // 图片文件
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.gif': 'image',
  '.bmp': 'image',
  '.webp': 'image',
  '.svg': 'image',
  '.ico': 'image',
  '.tiff': 'image',
  '.tif': 'image',
  
  // PDF文件
  '.pdf': 'pdf',
  
  // Excel文件
  '.xlsx': 'excel',
  '.xls': 'excel',
  '.xlsm': 'excel',
  '.xlsb': 'excel',
  '.csv': 'excel', // CSV也可以用Excel预览
  
  // Word文件
  '.docx': 'word',
  '.doc': 'word',
};

/**
 * 根据文件名检测文件类型
 */
export function getFileType(fileName: string): FileType {
  const ext = getFileExtension(fileName).toLowerCase();
  return FILE_TYPE_MAP[ext] || 'unknown';
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
    return '';
  }
  return fileName.substring(lastDotIndex);
}

/**
 * 检查文件是否支持预览
 */
export function isPreviewable(fileName: string): boolean {
  return getFileType(fileName) !== 'unknown';
}

/** 检查文件是否适合交给本地文本编辑器。 */
export function isTextEditable(fileName: string): boolean {
  const type = getFileType(fileName);
  const extension = getFileExtension(fileName).toLowerCase();
  const lowerName = fileName.toLowerCase();
  return type === 'text'
    || type === 'json'
    || type === 'code'
    || extension === '.csv'
    || extension === '.tsv'
    || extension === '.env'
    || extension === '.cfg'
    || extension === '.properties'
    || ['readme', 'license', 'dockerfile', 'makefile'].includes(lowerName);
}

/**
 * 获取文件类型的显示名称
 */
export function getFileTypeDisplayName(fileType: FileType): string {
  // 这里应该使用国际化，但由于这是一个工具函数，
  // 我们将在组件中处理国际化
  switch (fileType) {
    case 'text': return 'Text File';
    case 'json': return 'JSON File';
    case 'code': return 'Code File';
    case 'image': return 'Image File';
    case 'pdf': return 'PDF Document';
    case 'excel': return 'Excel Spreadsheet';
    case 'word': return 'Word Document';
    default: return 'Unknown Type';
  }
}
