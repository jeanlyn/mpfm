import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { formatFileSize } from './batchDownload';

export interface UploadProgress {
  transferred: number;
  total: number;
  fileName: string;
  fileIndex?: number;
  fileCount?: number;
  completed: boolean;
  error?: string;
  /** 目录上传汇总：成功文件数（仅完成事件携带） */
  uploadedCount?: number;
  /** 目录上传汇总：失败文件数（仅完成事件携带） */
  failedCount?: number;
  /** 当前上传的唯一 ID，用于发起取消 */
  uploadId?: string;
  /** 是否已被用户取消（完成事件携带） */
  cancelled?: boolean;
}

const UPLOAD_PROGRESS_EVENT = 'upload-progress';

export async function listenUploadProgress(
  onProgress: (progress: UploadProgress) => void
): Promise<UnlistenFn> {
  return listen<UploadProgress>(UPLOAD_PROGRESS_EVENT, (event) => {
    onProgress(event.payload);
  });
}

export function formatUploadSpeed(bytesPerSecond: number): string {
  return `${formatFileSize(bytesPerSecond)}/s`;
}
