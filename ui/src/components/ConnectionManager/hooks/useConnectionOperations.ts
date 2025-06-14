import { useCallback } from 'react';
import { message, Modal } from 'antd';
import { ApiService } from '../../../services/api';
import { MODAL_TYPES, ModalConfig, DirectoryItem } from '../types';
import { buildConfig } from '../utils.tsx';
import { useAppI18n } from '../../../i18n/hooks/useI18n';

/**
 * 连接操作处理Hook
 */
export const useConnectionOperations = (
  modalConfig: ModalConfig,
  directories: DirectoryItem[],
  saveDirectories: (dirs: DirectoryItem[]) => void,
  onConnectionsChange: () => void,
  closeModal: () => void
) => {
  const { connection: i18nConnection, s3, app } = useAppI18n();
  
  // S3 bucket 检查和创建
  const checkAndCreateS3Bucket = useCallback(async (values: any): Promise<boolean> => {
    if (values.protocolType !== 's3') return true;

    try {
      const bucketExists = await ApiService.checkS3BucketExists(
        values.bucket,
        values.region,
        values.endpoint || null,
        values.accessKey,
        values.secretKey
      );

      if (!bucketExists) {
        return new Promise((resolve) => {
          Modal.confirm({
            title: s3.bucketNotExists,
            content: s3.bucketNotExistsDescription.replace('{bucket}', values.bucket),
            okText: s3.createBucket,
            cancelText: app.cancel,
            onOk: async () => {
              try {
                await ApiService.createS3Bucket(
                  values.bucket,
                  values.region,
                  values.endpoint || null,
                  values.accessKey,
                  values.secretKey
                );
                message.success(s3.bucketCreateSuccess);
                resolve(true);
              } catch (error) {
                message.error(`${s3.bucketCreateFailed}: ${error}`);
                resolve(false);
              }
            },
            onCancel: () => {
              message.info(s3.operationCancelled);
              resolve(false);
            }
          });
        });
      }
      return true;
    } catch (error) {
      message.warning(`${s3.checkBucketFailed}: ${error}`);
      return true;
    }
  }, []);

  // 统一的连接操作处理
  const handleConnectionOperation = useCallback(async (values: any) => {
    const { type, connection } = modalConfig;
    
    try {
      const config = buildConfig(values);
      
      // 检查并创建 S3 bucket（编辑时不需要）
      if (type !== MODAL_TYPES.EDIT) {
        const bucketReady = await checkAndCreateS3Bucket(values);
        if (!bucketReady) return;
      }

      // 执行对应的操作
      let newConnectionId: string | null = null;
      
      switch (type) {
        case MODAL_TYPES.ADD:
          const addResult = await ApiService.addConnection(values.name, values.protocolType, config);
          newConnectionId = addResult?.id || `conn_${Date.now()}`;
          message.success(i18nConnection.messages.addSuccess);
          break;
        case MODAL_TYPES.COPY:
          const copyResult = await ApiService.addConnection(values.name, values.protocolType, config);
          newConnectionId = copyResult?.id || `conn_${Date.now()}`;
          message.success(i18nConnection.messages.copySuccess);
          break;
        case MODAL_TYPES.EDIT:
          if (!connection) return;
          await ApiService.updateConnection(connection.id, values.name, values.protocolType, config);
          message.success(i18nConnection.messages.editSuccess);
          break;
      }

      // 处理目录关联
      if (newConnectionId) {
        if (type === MODAL_TYPES.ADD && values.directoryId) {
          // 新建连接：添加到指定目录
          const newDirectories = directories.map(dir => {
            if (dir.id === values.directoryId) {
              return {
                ...dir,
                connectionIds: [...dir.connectionIds, newConnectionId]
              };
            }
            return dir;
          });
          saveDirectories(newDirectories);
        } else if (type === MODAL_TYPES.COPY && connection) {
          // 复制连接：保留原连接的目录信息
          const originalConnectionDirectories = directories.filter(dir => 
            dir.connectionIds.includes(connection.id)
          );
          
          if (originalConnectionDirectories.length > 0) {
            const newDirectories = directories.map(dir => {
              // 如果原连接在这个目录中，也将新连接添加到此目录
              if (dir.connectionIds.includes(connection.id)) {
                return {
                  ...dir,
                  connectionIds: [...dir.connectionIds, newConnectionId]
                };
              }
              return dir;
            });
            saveDirectories(newDirectories);
            
            const dirNames = originalConnectionDirectories.map(dir => dir.name).join('、');
            message.success(i18nConnection.messages.copySuccessWithDirectory.replace('{directories}', dirNames));
          } else {
            message.success(i18nConnection.messages.copySuccess);
          }
        }
      }

      closeModal();
      onConnectionsChange();
    } catch (error) {
      const failedMsg = type === MODAL_TYPES.ADD ? i18nConnection.messages.addFailed :
                       type === MODAL_TYPES.COPY ? i18nConnection.messages.copyFailed :
                       i18nConnection.messages.editFailed;
      message.error(`${failedMsg}: ${error}`);
    }
  }, [
    modalConfig, 
    directories, 
    saveDirectories, 
    onConnectionsChange, 
    closeModal, 
    checkAndCreateS3Bucket
  ]);

  // 删除连接处理
  const handleDeleteConnection = useCallback(async (connectionId: string) => {
    try {
      await ApiService.removeConnection(connectionId);
      message.success(i18nConnection.messages.deleteSuccess);
      onConnectionsChange();
    } catch (error) {
      message.error(`${i18nConnection.messages.deleteFailed}: ${error}`);
    }
  }, [onConnectionsChange, i18nConnection]);

  return {
    handleConnectionOperation,
    handleDeleteConnection,
  };
};
