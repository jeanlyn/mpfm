import { useCallback } from 'react';
import { message } from 'antd';
import { Connection, FileInfo } from '../../../types';
import { useAppI18n } from '../../../i18n/hooks/useI18n';
import { batchDownloadFiles, BatchDownloadProgress } from '../../../utils/batchDownload';
import { useFileSelection } from './useFileSelection';

/**
 * 预览和批量操作相关的 Hook
 */
export const usePreviewAndBatch = (
  connection: Connection | null,
  files: FileInfo[],
  searchResults: FileInfo[],
  isSearchMode: boolean,
  fileSelection: ReturnType<typeof useFileSelection>,
  onStateUpdate: (updates: any) => void
) => {
  const { fileManager } = useAppI18n();

  // 预览功能处理函数
  const handlePreview = useCallback((file: FileInfo) => {
    onStateUpdate({
      previewFile: file,
      previewVisible: true,
    });
  }, [onStateUpdate]);

  const handlePreviewClose = useCallback(() => {
    onStateUpdate({
      previewVisible: false,
      previewFile: null,
    });
  }, [onStateUpdate]);

  // 批量下载处理函数
  const handleBatchDownload = useCallback(async () => {
    if (!connection) return;
    
    const selectedFiles = fileSelection.getSelectedFiles(isSearchMode ? searchResults : files);
    if (selectedFiles.length === 0) {
      message.warning(fileManager.messages.noFilesSelected);
      return;
    }

    try {
      await batchDownloadFiles({
        connectionId: connection.id,
        files: selectedFiles,
        selectSaveLocationTitle: fileManager.messages.selectSaveLocation,
        onProgress: (progress: BatchDownloadProgress) => {
          onStateUpdate({ batchDownloadProgress: progress });
        },
        onDownloadStart: () => {
          // 用户选择了保存位置后，才显示进度模态框
          onStateUpdate({
            batchDownloadVisible: true,
            batchDownloadProgress: {
              current: 0,
              total: selectedFiles.length,
              currentFile: '',
              completed: false
            },
          });
        }
      });

      fileSelection.clearSelection();
    } catch (error) {
      message.error(`${fileManager.messages.batchDownloadFailed}: ${error}`);
      onStateUpdate((prevState: any) => ({
        batchDownloadProgress: prevState.batchDownloadProgress ? {
          ...prevState.batchDownloadProgress,
          error: error instanceof Error ? error.message : String(error)
        } : null
      }));
    }
  }, [
    connection, 
    fileSelection, 
    files, 
    searchResults, 
    isSearchMode, 
    fileManager.messages, 
    onStateUpdate
  ]);

  const handleBatchDownloadClose = useCallback(() => {
    onStateUpdate({
      batchDownloadVisible: false,
      batchDownloadProgress: null,
    });
  }, [onStateUpdate]);

  return {
    handlePreview,
    handlePreviewClose,
    handleBatchDownload,
    handleBatchDownloadClose,
  };
};
