import { ApiService } from '../../../services/api';
import { FileInfo } from '../../../types';
import { PAGINATION_MODE_THRESHOLD } from '../constants';
import { LoadingMode } from '../types';

export interface DirectoryFilesResult {
  mode: LoadingMode;
  files: FileInfo[];
  total: number;
  page: number;
}

/**
 * 加载目录文件，将「计数 + 列表」合并为尽可能少的后端 list 调用。
 * 优先用分页接口一次拿到 total 与首页数据，小目录且首页已含全部条目时直接复用。
 */
export async function loadDirectoryFiles(
  connectionId: string,
  path: string,
  page: number,
  pageSize: number
): Promise<DirectoryFilesResult> {
  if (page > 0) {
    const result = await ApiService.listFilesPaginated(connectionId, path, page, pageSize);
    return {
      mode: 'pagination',
      files: result.files,
      total: result.total,
      page: result.page,
    };
  }

  const result = await ApiService.listFilesPaginated(connectionId, path, 0, pageSize);
  const mode: LoadingMode =
    result.total > PAGINATION_MODE_THRESHOLD ? 'pagination' : 'all';

  if (mode === 'pagination') {
    return {
      mode,
      files: result.files,
      total: result.total,
      page: result.page,
    };
  }

  if (result.total <= pageSize) {
    return {
      mode,
      files: result.files,
      total: result.total,
      page: 0,
    };
  }

  const fileList = await ApiService.listFiles(connectionId, path);
  return {
    mode,
    files: fileList,
    total: fileList.length,
    page: 0,
  };
}
