import { FileInfo } from '../types';
import { ApiService } from '../services/api';
import { save } from '@tauri-apps/plugin-dialog';

export interface BatchDownloadProgress {
  current: number;
  total: number;
  currentFile: string;
  completed: boolean;
  error?: string;
}

export interface BatchDownloadOptions {
  connectionId: string;
  files: FileInfo[];
  onProgress: (progress: BatchDownloadProgress) => void;
  onDownloadStart?: () => void; // 当用户选择保存位置后调用
  zipFileName?: string;
  selectSaveLocationTitle?: string;
}

/**
 * 现在支持文件夹下载，不再过滤掉目录
 */
export function filterDownloadableFiles(files: FileInfo[]): FileInfo[] {
  // 现在允许下载所有类型的文件和文件夹
  return files;
}

/**
 * 生成默认的zip文件名
 */
export function generateZipFileName(baseName: string = 'batch_download'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  return `${baseName}_${timestamp}.zip`;
}

/**
 * 批量下载文件并打包成ZIP
 */
export async function batchDownloadFiles(options: BatchDownloadOptions): Promise<void> {
  const { connectionId, files, onProgress, onDownloadStart, zipFileName, selectSaveLocationTitle } = options;
  
  // 现在支持下载所有类型的文件（包括文件夹）
  const downloadableFiles = filterDownloadableFiles(files);
  
  if (downloadableFiles.length === 0) {
    throw new Error('No files selected for download');
  }

  // 选择保存位置
  const defaultFileName = zipFileName || generateZipFileName();
  const savePath = await save({
    defaultPath: defaultFileName,
    title: selectSaveLocationTitle || 'Select download save location',
    filters: [{
      name: 'ZIP Archive',
      extensions: ['zip']
    }]
  });

  if (!savePath) {
    throw new Error('No save location selected');
  }

  // 用户选择了保存位置，调用回调开始显示进度
  if (onDownloadStart) {
    onDownloadStart();
  }

  try {
    // 调用后端批量下载API（现在支持文件夹）
    await ApiService.batchDownloadFiles(
      connectionId,
      downloadableFiles.map(f => f.path),
      savePath,
      (current, total, currentFilePath) => {
        // 从路径中提取文件名
        const currentFileName = currentFilePath.split('/').pop() || currentFilePath;
        
        onProgress({
          current,
          total,
          currentFile: currentFileName,
          completed: false
        });
      }
    );

    // 下载完成
    onProgress({
      current: downloadableFiles.length,
      total: downloadableFiles.length,
      currentFile: '',
      completed: true
    });
  } catch (error) {
    onProgress({
      current: 0,
      total: downloadableFiles.length,
      currentFile: '',
      completed: false,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * 估算文件大小
 */
export function estimateTotalSize(files: FileInfo[]): number {
  return files.reduce((total, file) => {
    return total + (file.size || 0);
  }, 0);
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
