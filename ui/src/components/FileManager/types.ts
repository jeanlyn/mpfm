import { Connection, FileInfo } from '../../types';

export interface FileManagerProps {
  connection: Connection | null;
}

export interface PaginatedFileList {
  files: FileInfo[];
  total: number;
  page: number;
}

export interface BatchDownloadProgress {
  current: number;
  total: number;
  currentFile: string;
  completed: boolean;
  error?: string;
}

export interface FileManagerState {
  files: FileInfo[];
  currentPath: string;
  loading: boolean;
  createDirModalOpen: boolean;
  newDirName: string;
  
  // 分页相关状态
  currentPage: number;
  pageSize: number;
  totalFiles: number;
  loadingMode: 'pagination' | 'all';
  
  // 搜索相关状态
  searchQuery: string;
  isSearchMode: boolean;
  searchResults: FileInfo[];
  searchPage: number;
  searchTotal: number;
  
  // 预览相关状态
  previewVisible: boolean;
  previewFile: FileInfo | null;
  
  // 批量下载相关状态
  batchDownloadVisible: boolean;
  batchDownloadProgress: BatchDownloadProgress | null;
  
  // 动态计算表格高度
  tableHeight: number;
}

export type LoadingMode = 'pagination' | 'all';

export type { FileInfo };
