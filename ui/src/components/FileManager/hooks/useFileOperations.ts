import { useCallback } from 'react';
import { message, Modal } from 'antd';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Connection, FileInfo } from '../../../types';
import { ApiService } from '../../../services/api';
import { useAppI18n } from '../../../i18n/hooks/useI18n';
import { UploadProgress } from '../../../utils/uploadProgress';
import { extractLocalFileName } from '../utils';
import { loadDirectoryFiles } from '../utils/loadDirectoryFiles';
import { isLocalDirectory } from '../utils/isLocalDirectory';

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
  const { fileManager, app } = useAppI18n();

  // 加载文件列表
  const loadFiles = useCallback(async (path: string, page: number = 0) => {
    if (!connection) return;
    
    onStateUpdate({ loading: true });
    
    try {
      const result = await loadDirectoryFiles(connection.id, path, page, pageSize);
      onStateUpdate({
        loadingMode: result.mode,
        files: result.files,
        totalFiles: result.total,
        currentPage: result.page,
        currentPath: path,
      });
    } catch (error) {
      message.error(`${fileManager.messages.loadFilesFailed}: ${error}`);
    } finally {
      onStateUpdate({ loading: false });
    }
  }, [connection, pageSize, onStateUpdate, fileManager.messages.loadFilesFailed]);

  // 文件双击处理
  const handleFileDoubleClick = useCallback((file: FileInfo) => {
    if (file.is_dir) {
      const newPath = file.path.endsWith('/') ? file.path : file.path + '/';
      onStateUpdate({ currentPage: 0 }); // 重置到第一页
      loadFiles(newPath);
    }
  }, [loadFiles, onStateUpdate]);

  const performFileUpload = useCallback(async (
    localPath: string,
    remotePath: string,
    fileName: string,
  ) => {
    if (!connection) return;

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
        localPath,
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
  }, [connection, currentPath, currentPage, loadFiles, onStateUpdate, fileManager.messages.uploadSuccess]);

  const confirmUploadOverwrite = useCallback((remotePath: string) => {
    return new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: fileManager.messages.uploadOverwriteTitle,
        content: fileManager.messages.uploadOverwriteDescription.replace('{path}', remotePath),
        okText: fileManager.messages.uploadOverwriteConfirm,
        cancelText: app.cancel,
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, [app.cancel, fileManager.messages.uploadOverwriteTitle, fileManager.messages.uploadOverwriteDescription, fileManager.messages.uploadOverwriteConfirm]);

  const buildRemotePath = useCallback((fileName: string) => {
    return currentPath.endsWith('/')
      ? currentPath + fileName
      : currentPath + '/' + fileName;
  }, [currentPath]);

  const checkUploadConflict = useCallback(async (remotePath: string): Promise<boolean> => {
    if (!connection) return false;

    const pathInfo = await ApiService.checkFileExists(connection.id, remotePath);
    if (!pathInfo.exists) {
      return true;
    }

    if (pathInfo.isDir) {
      Modal.warning({
        title: fileManager.messages.uploadConflictDirectoryTitle,
        content: fileManager.messages.uploadConflictDirectoryDescription.replace('{path}', remotePath),
        okText: app.confirm,
      });
      return false;
    }

    return confirmUploadOverwrite(remotePath);
  }, [
    connection,
    app.confirm,
    confirmUploadOverwrite,
    fileManager.messages.uploadConflictDirectoryTitle,
    fileManager.messages.uploadConflictDirectoryDescription,
  ]);

  const performDirectoryUpload = useCallback(async (localDirPath: string) => {
    if (!connection) return;

    onStateUpdate({
      uploadVisible: true,
      uploadProgress: {
        transferred: 0,
        total: 0,
        fileName: '',
        completed: false,
      },
    });

    const lastProgressRef: { current: UploadProgress | null } = { current: null };
    try {
      const count = await ApiService.uploadDirectory(
        connection.id,
        localDirPath,
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
      if (lastProgressRef.current?.cancelled) {
        return;
      }
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
  }, [connection, currentPath, currentPage, loadFiles, onStateUpdate, fileManager.messages.uploadDirectorySuccess]);

  const uploadLocalFile = useCallback(async (localPath: string) => {
    const fileName = (await extractLocalFileName(localPath)) || 'uploaded_file';
    const remotePath = buildRemotePath(fileName);

    if (!(await checkUploadConflict(remotePath))) {
      return;
    }

    await performFileUpload(localPath, remotePath, fileName);
  }, [buildRemotePath, checkUploadConflict, performFileUpload]);

  const uploadLocalPath = useCallback(async (localPath: string) => {
    if (!connection) return;

    if (await isLocalDirectory(localPath)) {
      await performDirectoryUpload(localPath);
    } else {
      await uploadLocalFile(localPath);
    }
  }, [connection, performDirectoryUpload, uploadLocalFile]);

  const uploadLocalPaths = useCallback(async (paths: string[]) => {
    if (!connection || paths.length === 0) return;

    for (const localPath of paths) {
      try {
        await uploadLocalPath(localPath);
      } catch (error) {
        message.error(`${fileManager.messages.uploadFailed}: ${error}`);
      }
    }
  }, [connection, uploadLocalPath, fileManager.messages.uploadFailed]);

  // 上传文件
  const handleUpload = useCallback(async () => {
    if (!connection) return;

    try {
      const selected = await open({
        multiple: false,
        title: fileManager.dialogs.selectFileToUpload,
      });

      if (selected && typeof selected === 'string') {
        await uploadLocalPath(selected);
      }
    } catch (error) {
      message.error(`${fileManager.messages.uploadFailed}: ${error}`);
    }
  }, [
    connection,
    uploadLocalPath,
    fileManager.dialogs.selectFileToUpload,
    fileManager.messages.uploadFailed,
  ]);

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
        await performDirectoryUpload(selected);
      }
    } catch (error) {
      message.error(`${fileManager.messages.uploadDirectoryFailed || '上传文件夹失败'}: ${error}`);
    }
  }, [connection, performDirectoryUpload, fileManager.dialogs, fileManager.messages.uploadDirectoryFailed]);

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

  // 复制 curl 下载命令
  const handleCopyDownloadCurlCommand = useCallback(async (file: FileInfo) => {
    if (!connection || file.is_dir) return;

    try {
      const command = await ApiService.buildDownloadCurlCommand(connection.id, file.path);
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
    uploadLocalPaths,
    handleUploadClose,
    handleDownload,
    handleCopyDownloadCommand,
    handleCopyDownloadCurlCommand,
    handleDelete,
    handleCreateDirectory,
    navigateUp,
  };
};
