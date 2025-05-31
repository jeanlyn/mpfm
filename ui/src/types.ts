export interface Connection {
  id: string;
  name: string;
  protocol_type: string;
  config: Record<string, string>;
}

export interface FileInfo {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
  modified?: string;
}

export interface PaginatedFileList {
  files: FileInfo[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
