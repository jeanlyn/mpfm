import { useCallback } from 'react';
import { message } from 'antd';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Connection, FileInfo } from '../../../types';
import { ApiService } from '../../../services/api';
import { useAppI18n } from '../../../i18n/hooks/useI18n';
import { PaginatedFileList, LoadingMode } from '../types';
import { UploadProgress } from '../../../utils/uploadProgress';
import { PAGINATION_MODE_THRESHOLD } from '../constants';

/**
 * 文件操作相关的 Hook
 */
export const useFileOperations = (
  connection: Connection | null,
  currentPath: string,
  currentPage: number,
  pageSize: number,
  onStateUpdate: (updates: any) => void
) => {
  const { fileManager } = useAppI18n();

  // 智能选择加载模式
  const chooseLoadingMode = useCallback(async (path: string): Promise<LoadingMode> => {
    if (!connection) return 'pagination';
    
    try {
      const count = await ApiService.getDirectoryCount(connection.id, path);
      
      // 如果文件数量超过100个，使用分页模式
      if (count > PAGINATION_MODE_THRESHOLD) {
        return 'pagination';
      } else {
        return 'all';
      }
    } catch (error) {
      console.warn(fileManager.messages.directoryCountWarning, error);
      return 'pagination';
    }
  }, [connection, fileManager.messages.directoryCountWarning]);

  // 加载文件列表
  const loadFiles = useCallback(async (path: string, page: number = 0) => {
    if (!connection) return;
    
    onStateUpdate({ loading: true });
    
    try {
      const mode = await chooseLoadingMode(path);
      onStateUpdate({ loadingMode: mode });
      
      if (mode === 'pagination') {
        // 分页模式
        const result: PaginatedFileList = await ApiService.listFilesPaginated(
          connection.id, 
          path, 
          page, 
          pageSize
        );
        
        onStateUpdate({
          files: result.files,
          totalFiles: result.total,
          currentPage: result.page,
          currentPath: path,
        });
      } else {
        // 全量加载模式（适用于小目录）
        const fileList = await ApiService.listFiles(connection.id, path);
        onStateUpdate({
          files: fileList,
          totalFiles: fileList.length,
          currentPage: 0,
          currentPath: path,
        });
      }
      
    } catch (error) {
      message.error(`${fileManager.messages.loadFilesFailed}: ${error}`);
    } finally {
      onStateUpdate({ loading: false });
    }
  }, [connection, pageSize, chooseLoadingMode, onStateUpdate, fileManager.messages.loadFilesFailed]);

  // 文件双击处理
  const handleFileDoubleClick = useCallback((file: FileInfo) => {
    if (file.is_dir) {
      const newPath = file.path.endsWith('/') ? file.path : file.path + '/';
      onStateUpdate({ currentPage: 0 }); // 重置到第一页
      loadFiles(newPath);
    }
  }, [loadFiles, onStateUpdate]);

  // 上传文件
  const handleUpload = useCallback(async () => {
    if (!connection) return;

    try {
      const selected = await open({
        multiple: false,
        title: fileManager.dialogs.selectFileToUpload,
      });

      if (selected && typeof selected === 'string') {
        const fileName = selected.split('/').pop() || 'uploaded_file';
        const remotePath = currentPath.endsWith('/') 
          ? currentPath + fileName 
          : currentPath + '/' + fileName;

        onStateUpdate({
          uploadVisible: true,
          uploadProgress: {
            transferred: 0,
            total: 0,
            fileName,
            completed: false,
          },
        });

        // 用对象包裹记录最后一次进度，绕过 TS 控制流分析（异步回调中的赋值对 catch 不可见）。
        const lastProgressRef: { current: UploadProgress | null } = { current: null };
        try {
          await ApiService.uploadFile(
            connection.id,
            selected,
            remotePath,
            (progress: UploadProgress) => {
              lastProgressRef.current = progress;
              onStateUpdate({ uploadProgress: progress });
            }
          );
          message.success(fileManager.messages.uploadSuccess);
          loadFiles(currentPath, currentPage);
        } catch (error) {
          // 取消时后端已通过事件下发 cancelled 态，这里不覆盖、也不当作失败提示
          if (lastProgressRef.current?.cancelled) {
            return;
          }
          const fallbackError =
            error instanceof Error ? error.message : String(error);
          onStateUpdate({
            uploadProgress: {
              transferred: 0,
              total: 0,
              fileName,
              completed: true,
              error: fallbackError,
            },
          });
          throw error;
        }
      }
    } catch (error) {
      message.error(`${fileManager.messages.uploadFailed}: ${error}`);
    }
  }, [connection, currentPath, currentPage, loadFiles, onStateUpdate, fileManager.dialogs.selectFileToUpload, fileManager.messages.uploadSuccess, fileManager.messages.uploadFailed]);

  const handleUploadClose = useCallback(() => {
    onStateUpdate({
      uploadVisible: false,
      uploadProgress: null,
    });
  }, [onStateUpdate]);

  // 上传文件夹
  const handleUploadDirectory = useCallback(async () => {
    if (!connection) return;

    try {
      const selected = await open({
        multiple: false,
        directory: true,
        title: fileManager.dialogs.selectDirectoryToUpload || '选择要上传的文件夹',
      });

      if (selected && typeof selected === 'string') {
        onStateUpdate({
          uploadVisible: true,
          uploadProgress: {
            transferred: 0,
            total: 0,
            fileName: '',
            completed: false,
          },
        });

        // 记录最后一次进度事件，便于在失败时保留汇总信息（uploaded/failed/total）。
        // 用对象包裹以绕过 TS 控制流分析（异步回调中的赋值对 catch 不可见）。
        const lastProgressRef: { current: UploadProgress | null } = { current: null };
        try {
          const count = await ApiService.uploadDirectory(
            connection.id,
            selected,
            currentPath,
            (progress: UploadProgress) => {
              lastProgressRef.current = progress;
              onStateUpdate({ uploadProgress: progress });
            }
          );
          message.success(
            (fileManager.messages.uploadDirectorySuccess || '文件夹上传成功，共上传 {count} 个文件')
              .replace('{count}', count.toString())
          );
          loadFiles(currentPath, currentPage);
        } catch (error) {
          // 取消时后端已通过事件下发 cancelled 态，这里不覆盖、也不当作失败提示
          if (lastProgressRef.current?.cancelled) {
            return;
          }
          // 部分失败时，Rust 在最终完成事件里已携带 uploadedCount/failedCount/error，
          // 此处保留这些信息（仅补上 completed 以便用户关闭对话框），避免覆盖丢失。
          const fallbackError =
            error instanceof Error ? error.message : String(error);
          const last = lastProgressRef.current;
          onStateUpdate({
            uploadProgress: {
              transferred: 0,
              total: 0,
              fileName: '',
              completed: true,
              fileCount: last?.fileCount,
              uploadedCount: last?.uploadedCount,
              failedCount: last?.failedCount,
              error: last?.error ?? fallbackError,
            },
          });
          throw error;
        }
      }
    } catch (error) {
      message.error(`${fileManager.messages.uploadDirectoryFailed || '上传文件夹失败'}: ${error}`);
    }
  }, [connection, currentPath, currentPage, loadFiles, onStateUpdate, fileManager.dialogs, fileManager.messages]);

  // 下载文件
  const handleDownload = useCallback(async (file: FileInfo) => {
    if (!connection || file.is_dir) return;

    try {
      const savePath = await save({
        defaultPath: file.name,
        title: fileManager.dialogs.selectSaveLocation,
      });

      if (savePath) {
        await ApiService.downloadFile(connection.id, file.path, savePath);
        message.success(fileManager.messages.downloadSuccess);
      }
    } catch (error) {
      message.error(`${fileManager.messages.downloadFailed}: ${error}`);
    }
  }, [connection, fileManager.dialogs.selectSaveLocation, fileManager.messages.downloadSuccess, fileManager.messages.downloadFailed]);

  // 复制 CLI 下载命令
  const handleCopyDownloadCommand = useCallback(async (
    file: FileInfo,
    targetShell: 'bash' | 'powershell'
  ) => {
    if (!connection || file.is_dir) return;

    try {
      const command = await ApiService.buildDownloadCommand(connection.id, file.path, targetShell);
      await ApiService.copyTextToClipboard(command);
      message.success(fileManager.messages.copySuccess);
    } catch (error) {
      message.error(`${fileManager.messages.copyFailed}: ${error}`);
    }
  }, [connection, fileManager.messages.copySuccess, fileManager.messages.copyFailed]);

  // 删除文件
  const handleDelete = useCallback(async (file: FileInfo) => {
    if (!connection) return;

    try {
      await ApiService.deleteFile(connection.id, file.path);
      message.success(fileManager.messages.deleteSuccess);
      loadFiles(currentPath, currentPage);
    } catch (error) {
      message.error(`${fileManager.messages.deleteFailed}: ${error}`);
    }
  }, [connection, currentPath, currentPage, loadFiles, fileManager.messages.deleteSuccess, fileManager.messages.deleteFailed]);

  // 创建目录
  const handleCreateDirectory = useCallback(async (dirName: string) => {
    if (!connection || !dirName.trim()) return;

    try {
      const dirPath = currentPath.endsWith('/') 
        ? currentPath + dirName.trim()
        : currentPath + '/' + dirName.trim();

      await ApiService.createDirectory(connection.id, dirPath);
      message.success(fileManager.messages.createDirectorySuccess);
      loadFiles(currentPath, currentPage);
      return true;
    } catch (error) {
      message.error(`${fileManager.messages.createDirectoryFailed}: ${error}`);
      return false;
    }
  }, [connection, currentPath, currentPage, loadFiles, fileManager.messages.createDirectorySuccess, fileManager.messages.createDirectoryFailed]);

  // 向上导航
  const navigateUp = useCallback(() => {
    if (currentPath === '/') return;
    
    const pathParts = currentPath.split('/').filter(part => part);
    pathParts.pop();
    const newPath = pathParts.length === 0 ? '/' : '/' + pathParts.join('/') + '/';
    onStateUpdate({ currentPage: 0 });
    loadFiles(newPath);
  }, [currentPath, loadFiles, onStateUpdate]);

  return {
    loadFiles,
    handleFileDoubleClick,
    handleUpload,
    handleUploadDirectory,
    handleUploadClose,
    handleDownload,
    handleCopyDownloadCommand,
    handleDelete,
    handleCreateDirectory,
    navigateUp,
    chooseLoadingMode,
  };
};
