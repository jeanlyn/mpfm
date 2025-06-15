import { useCallback } from 'react';
import { message } from 'antd';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Connection, FileInfo } from '../../../types';
import { ApiService } from '../../../services/api';
import { useAppI18n } from '../../../i18n/hooks/useI18n';
import { PaginatedFileList, LoadingMode } from '../types';
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

        await ApiService.uploadFile(connection.id, selected, remotePath);
        message.success(fileManager.messages.uploadSuccess);
        loadFiles(currentPath, currentPage);
      }
    } catch (error) {
      message.error(`${fileManager.messages.uploadFailed}: ${error}`);
    }
  }, [connection, currentPath, currentPage, loadFiles, fileManager.dialogs.selectFileToUpload, fileManager.messages.uploadSuccess, fileManager.messages.uploadFailed]);

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
    handleDownload,
    handleDelete,
    handleCreateDirectory,
    navigateUp,
    chooseLoadingMode,
  };
};
