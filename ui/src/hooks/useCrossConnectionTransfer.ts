import { useCallback } from 'react';
import { Modal, message } from 'antd';
import { Connection, FileInfo } from '../types';
import { ApiService } from '../services/api';
import { useAppI18n } from '../i18n/hooks/useI18n';
import { useConnectionPathRegistry } from '../contexts/ConnectionPathRegistry';
import { UploadProgress } from '../utils/uploadProgress';

interface TransferStateHandlers {
  setUploadVisible: (visible: boolean) => void;
  setUploadProgress: (progress: UploadProgress | null) => void;
}

const buildRemotePath = (basePath: string, fileName: string): string => {
  return basePath.endsWith('/')
    ? basePath + fileName
    : basePath + '/' + fileName;
};

export const useCrossConnectionTransfer = (handlers: TransferStateHandlers) => {
  const { fileManager, app } = useAppI18n();
  const { getPath, refreshConnection } = useConnectionPathRegistry();

  const confirmOverwrite = useCallback(
    (remotePath: string) =>
      new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: fileManager.messages.uploadOverwriteTitle,
          content: fileManager.messages.uploadOverwriteDescription.replace('{path}', remotePath),
          okText: fileManager.messages.uploadOverwriteConfirm,
          cancelText: app.cancel,
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      }),
    [
      app.cancel,
      fileManager.messages.uploadOverwriteTitle,
      fileManager.messages.uploadOverwriteDescription,
      fileManager.messages.uploadOverwriteConfirm,
    ]
  );

  const checkTargetConflicts = useCallback(
    async (
      targetConnectionId: string,
      targetBasePath: string,
      files: FileInfo[]
    ): Promise<boolean> => {
      for (const file of files) {
        const remotePath = file.is_dir
          ? buildRemotePath(
              targetBasePath.endsWith('/') ? targetBasePath : `${targetBasePath}/`,
              file.name
            )
          : buildRemotePath(targetBasePath, file.name);

        const pathInfo = await ApiService.checkFileExists(targetConnectionId, remotePath);
        if (!pathInfo.exists) {
          continue;
        }

        if (pathInfo.isDir) {
          Modal.warning({
            title: fileManager.messages.uploadConflictDirectoryTitle,
            content: fileManager.messages.uploadConflictDirectoryDescription.replace(
              '{path}',
              remotePath
            ),
            okText: app.confirm,
          });
          return false;
        }

        const confirmed = await confirmOverwrite(remotePath);
        if (!confirmed) {
          return false;
        }
      }
      return true;
    },
    [
      app.confirm,
      confirmOverwrite,
      fileManager.messages.uploadConflictDirectoryTitle,
      fileManager.messages.uploadConflictDirectoryDescription,
    ]
  );

  const transferFiles = useCallback(
    async (
      sourceConnectionId: string,
      files: FileInfo[],
      targetConnection: Connection
    ) => {
      if (files.length === 0) {
        return;
      }

      const targetBasePath = getPath(targetConnection.id);
      const sourcePaths = files.map((f) => f.path);

      const canProceed = await checkTargetConflicts(
        targetConnection.id,
        targetBasePath,
        files
      );
      if (!canProceed) {
        return;
      }

      const displayName =
        files.length === 1 ? files[0].name : `${files.length} ${fileManager.actions.copy}`;

      handlers.setUploadVisible(true);
      handlers.setUploadProgress({
        transferred: 0,
        total: 0,
        fileName: displayName,
        completed: false,
      });

      const lastProgressRef: { current: UploadProgress | null } = { current: null };

      try {
        const count = await ApiService.copyFilesBetweenConnections(
          sourceConnectionId,
          sourcePaths,
          targetConnection.id,
          targetBasePath,
          (progress) => {
            lastProgressRef.current = progress;
            handlers.setUploadProgress(progress);
          }
        );

        message.success(
          fileManager.messages.copySuccess.replace('{count}', count.toString())
        );
        refreshConnection(targetConnection.id);
      } catch (error) {
        if (lastProgressRef.current?.cancelled) {
          return;
        }
        const fallbackError =
          error instanceof Error ? error.message : String(error);
        handlers.setUploadProgress({
          transferred: 0,
          total: 0,
          fileName: displayName,
          completed: true,
          error: fallbackError,
        });
        message.error(`${fileManager.messages.copyFailed}: ${fallbackError}`);
      }
    },
    [
      checkTargetConflicts,
      fileManager.actions.copy,
      fileManager.messages.copyFailed,
      fileManager.messages.copySuccess,
      getPath,
      handlers,
      refreshConnection,
    ]
  );

  return { transferFiles };
};
