import { useCallback } from 'react';
import { Modal, message } from 'antd';
import { Connection, FileInfo, CopyResultSummary } from '../types';
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

  /// 检查目标侧冲突，对已存在的文件询问是否覆盖、对同名目录直接拒绝。
  /// 返回 { canProceed, overwrite }：canProceed 为 false 表示用户已中止，
  /// overwrite 表示本次复制是否应按覆盖模式执行。
  const checkTargetConflicts = useCallback(
    async (
      targetConnectionId: string,
      targetBasePath: string,
      files: FileInfo[]
    ): Promise<{ canProceed: boolean; overwrite: boolean }> => {
      let overwrite = false;
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
          return { canProceed: false, overwrite: false };
        }

        const confirmed = await confirmOverwrite(remotePath);
        if (!confirmed) {
          return { canProceed: false, overwrite: false };
        }
        overwrite = true;
      }
      return { canProceed: true, overwrite };
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

      // 同连接自复制短路：源与目标是同一连接时直接忽略
      if (sourceConnectionId === targetConnection.id) {
        message.info(fileManager.messages.copySameConnectionIgnored);
        return;
      }

      const targetBasePath = getPath(targetConnection.id);
      const sourcePaths = files.map((f) => f.path);

      const { canProceed, overwrite } = await checkTargetConflicts(
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
        const result: CopyResultSummary = await ApiService.copyFilesBetweenConnections(
          sourceConnectionId,
          sourcePaths,
          targetConnection.id,
          targetBasePath,
          overwrite,
          (progress) => {
            lastProgressRef.current = progress;
            handlers.setUploadProgress(progress);
          }
        );

        if (result.failed === 0) {
          message.success(
            fileManager.messages.copySuccess.replace('{count}', String(result.copied))
          );
        } else {
          message.warning(
            fileManager.messages.copyPartial
              .replace('{copied}', String(result.copied))
              .replace('{failed}', String(result.failed))
          );
        }
        refreshConnection(targetConnection.id);
      } catch (error) {
        if (lastProgressRef.current?.cancelled) {
          return;
        }
        const fallbackError = error instanceof Error ? error.message : String(error);
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
      fileManager.messages.copySameConnectionIgnored,
      fileManager.messages.copySuccess,
      fileManager.messages.copyPartial,
      getPath,
      handlers,
      refreshConnection,
    ]
  );

  return { transferFiles };
};
