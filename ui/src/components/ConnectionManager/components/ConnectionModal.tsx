import React, { useMemo } from 'react';
import { Modal, Form, Input, Select, Button } from 'antd';
import { ModalConfig, MODAL_TYPES } from '../types';
import { DirectoryItem } from '../types';
import { ProtocolFields } from './ProtocolFields';
import { useAppI18n } from '../../../i18n/hooks/useI18n';

interface ConnectionModalProps {
  modalConfig: ModalConfig;
  directories: DirectoryItem[];
  form: any;
  onFinish: (values: any) => void;
  onCancel: () => void;
}

/**
 * 连接操作模态框组件
 */
export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  modalConfig,
  directories,
  form,
  onFinish,
  onCancel,
}) => {
  const { app, connection } = useAppI18n();
  // 获取模态框标题
  const modalTitle = useMemo(() => {
    switch (modalConfig.type) {
      case MODAL_TYPES.ADD: return connection.modal.addConnectionTitle;
      case MODAL_TYPES.COPY: return connection.modal.copyConnectionTitle;
      case MODAL_TYPES.EDIT: return connection.modal.editConnectionTitle;
      default: return connection.modal.defaultTitle;
    }
  }, [modalConfig.type, connection.modal]);

  // 获取提交按钮文本
  const submitButtonText = useMemo(() => {
    switch (modalConfig.type) {
      case MODAL_TYPES.ADD: return connection.modal.addConnectionButton;
      case MODAL_TYPES.COPY: return connection.modal.copyConnectionButton;
      case MODAL_TYPES.EDIT: return connection.modal.editConnectionButton;
      default: return connection.modal.defaultButton;
    }
  }, [modalConfig.type, connection.modal]);

  return (
    <Modal
      title={modalTitle}
      open={modalConfig.isOpen}
      onCancel={onCancel}
      footer={null}
      width={600}
      style={{ maxWidth: '90vw' }}
      styles={{ 
        body: {
          maxHeight: '70vh', 
          overflowY: 'auto',
          padding: '20px'
        }
      }}
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item
          name="name"
          label={connection.modal.nameLabel}
          rules={[{ required: true, message: connection.modal.nameRequired }]}
        >
          <Input 
            placeholder={connection.modal.namePlaceholder}
            style={{ width: '100%' }}
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item
          name="protocolType"
          label={connection.modal.protocolLabel}
          rules={[{ required: true, message: connection.modal.protocolRequired }]}
        >
          <Select 
            placeholder={connection.modal.protocolPlaceholder}
            style={{ width: '100%' }}
          >
            <Select.Option value="s3">{connection.modal.protocolS3}</Select.Option>
            <Select.Option value="fs">{connection.modal.protocolFs}</Select.Option>
            <Select.Option value="ftp">{connection.modal.protocolFtp}</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="directoryId"
          label={connection.modal.directoryLabel}
        >
          <Select
            placeholder={connection.modal.directoryPlaceholder}
            options={directories
              .sort((a, b) => a.name.localeCompare(b.name)) // 按名称排序
              .map(dir => ({ 
                label: dir.name, 
                value: dir.id 
              }))}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item dependencies={['protocolType']} noStyle>
          {({ getFieldValue }) => {
            const protocolType = getFieldValue('protocolType');
            return <ProtocolFields protocolType={protocolType} />;
          }}
        </Form.Item>

        <Form.Item>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button onClick={onCancel}>{app.cancel}</Button>
            <Button type="primary" htmlType="submit">
              {submitButtonText}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};
