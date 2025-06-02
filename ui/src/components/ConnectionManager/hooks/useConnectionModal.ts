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
      
      initialValues = {
        name: `${connection.name} - 副本`,
        protocolType: connection.protocol_type,
        directoryId: preferredDirectory?.id, // 设置目录ID
        ...connection.config,
        accessKey: connection.config.access_key,
        secretKey: connection.config.secret_key,
      };
    } else if (type === MODAL_TYPES.EDIT && connection) {
      initialValues = {
        name: connection.name,
        protocolType: connection.protocol_type,
        ...connection.config,
        accessKey: connection.config.access_key,
        secretKey: connection.config.secret_key,
      };
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
