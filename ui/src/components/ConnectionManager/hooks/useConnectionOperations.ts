import { useCallback } from 'react';
import { message, Modal } from 'antd';
import { ApiService } from '../../../services/api';
import { MODAL_TYPES, ModalConfig, DirectoryItem } from '../types';
import { buildConfig } from '../utils.tsx';

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
            title: 'Bucket 不存在',
            content: `存储桶 "${values.bucket}" 不存在，是否要创建该存储桶？`,
            okText: '创建',
            cancelText: '取消',
            onOk: async () => {
              try {
                await ApiService.createS3Bucket(
                  values.bucket,
                  values.region,
                  values.endpoint || null,
                  values.accessKey,
                  values.secretKey
                );
                message.success('存储桶创建成功');
                resolve(true);
              } catch (error) {
                message.error(`创建存储桶失败: ${error}`);
                resolve(false);
              }
            },
            onCancel: () => {
              message.info('已取消操作');
              resolve(false);
            }
          });
        });
      }
      return true;
    } catch (error) {
      message.warning(`检查存储桶状态失败: ${error}，将继续尝试操作`);
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
          message.success('连接添加成功');
          break;
        case MODAL_TYPES.COPY:
          const copyResult = await ApiService.addConnection(values.name, values.protocolType, config);
          newConnectionId = copyResult?.id || `conn_${Date.now()}`;
          message.success('连接复制成功');
          break;
        case MODAL_TYPES.EDIT:
          if (!connection) return;
          await ApiService.updateConnection(connection.id, values.name, values.protocolType, config);
          message.success('连接编辑成功');
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
            message.success(`连接复制成功，已添加到目录：${dirNames}`);
          } else {
            message.success('连接复制成功');
          }
        }
      }

      closeModal();
      onConnectionsChange();
    } catch (error) {
      const operationName = type === MODAL_TYPES.ADD ? '添加' : type === MODAL_TYPES.COPY ? '复制' : '编辑';
      message.error(`${operationName}连接失败: ${error}`);
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
      message.success('连接删除成功');
      onConnectionsChange();
    } catch (error) {
      message.error(`删除连接失败: ${error}`);
    }
  }, [onConnectionsChange]);

  return {
    handleConnectionOperation,
    handleDeleteConnection,
  };
};
