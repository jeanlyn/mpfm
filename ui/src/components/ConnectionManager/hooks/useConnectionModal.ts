import { useState, useCallback } from 'react';
import { Form } from 'antd';
import { ModalConfig, ModalType, MODAL_TYPES } from '../types';
import { Connection } from '../../../types';

/**
 * 连接模态框管理Hook
 */
export const useConnectionModal = (directories: any[]) => {
  const [modalConfig, setModalConfig] = useState<ModalConfig>({
    isOpen: false,
    type: MODAL_TYPES.ADD
  });
  const [form] = Form.useForm();

  // 打开模态框的统一方法
  const openModal = useCallback((type: ModalType, connection?: Connection) => {
    setModalConfig({ isOpen: true, type, connection });
    
    // 设置表单初始值
    let initialValues: any = {};
    
    if (type === MODAL_TYPES.COPY && connection) {
      // 找到原连接所在的目录
      const connectionDirectories = directories.filter(dir => 
        dir.connectionIds.includes(connection.id)
      );
      // 优先选择非默认目录，如果没有则选择默认目录
      const preferredDirectory = connectionDirectories.find(dir => dir.id !== 'default') || 
                                connectionDirectories.find(dir => dir.id === 'default');
      
      // 根据协议类型设置基础信息
      initialValues = {
        name: `${connection.name} - 副本`,
        protocolType: connection.protocol_type,
        directoryId: preferredDirectory?.id, // 设置目录ID
      };

      // 根据协议类型填充特定配置
      if (connection.protocol_type === 's3') {
        initialValues = {
          ...initialValues,
          bucket: connection.config.bucket,
          region: connection.config.region,
          endpoint: connection.config.endpoint,
          accessKey: connection.config.access_key,
          secretKey: connection.config.secret_key,
        };
      } else if (connection.protocol_type === 'fs') {
        initialValues = {
          ...initialValues,
          root_dir: connection.config.root_dir,
        };
      } else if (connection.protocol_type === 'ftp') {
        initialValues = {
          ...initialValues,
          host: connection.config.host,
          port: connection.config.port,
          username: connection.config.username,
          password: connection.config.password,
          root_dir: connection.config.root_dir,
          secure: connection.config.secure === 'true',
        };
      } else if (connection.protocol_type === 'ftp') {
        initialValues = {
          ...initialValues,
          host: connection.config.host,
          port: connection.config.port,
          username: connection.config.username,
          password: connection.config.password,
          root_dir: connection.config.root_dir,
          secure: connection.config.secure === 'true',
        };
      }
    } else if (type === MODAL_TYPES.EDIT && connection) {
      // 找到原连接所在的目录（编辑模式需要显示目录信息）
      const connectionDirectories = directories.filter(dir => 
        dir.connectionIds.includes(connection.id)
      );
      const preferredDirectory = connectionDirectories.find(dir => dir.id !== 'default') || 
                                connectionDirectories.find(dir => dir.id === 'default');

      // 根据协议类型设置基础信息
      initialValues = {
        name: connection.name,
        protocolType: connection.protocol_type,
        directoryId: preferredDirectory?.id, // 显示目录信息
      };

      // 根据协议类型填充特定配置
      if (connection.protocol_type === 's3') {
        initialValues = {
          ...initialValues,
          bucket: connection.config.bucket,
          region: connection.config.region,
          endpoint: connection.config.endpoint,
          accessKey: connection.config.access_key,
          secretKey: connection.config.secret_key,
        };
      } else if (connection.protocol_type === 'fs') {
        initialValues = {
          ...initialValues,
          root_dir: connection.config.root_dir,
        };
      } else if (connection.protocol_type === 'ftp') {
        initialValues = {
          ...initialValues,
          host: connection.config.host,
          port: connection.config.port,
          username: connection.config.username,
          password: connection.config.password,
          root_dir: connection.config.root_dir,
          secure: connection.config.secure === 'true',
        };
      } else if (connection.protocol_type === 'ftp') {
        initialValues = {
          ...initialValues,
          host: connection.config.host,
          port: connection.config.port,
          username: connection.config.username,
          password: connection.config.password,
          root_dir: connection.config.root_dir,
          secure: connection.config.secure === 'true',
        };
      }
    }
    
    form.setFieldsValue(initialValues);
  }, [form, directories]);

  // 关闭模态框
  const closeModal = useCallback(() => {
    setModalConfig({ isOpen: false, type: MODAL_TYPES.ADD });
    form.resetFields();
  }, [form]);

  return {
    modalConfig,
    setModalConfig,
    form,
    openModal,
    closeModal,
  };
};
