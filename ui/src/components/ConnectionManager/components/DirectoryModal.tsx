import React from 'react';
import { Modal, Form, Input, Select, Button } from 'antd';
import { DirectoryItem } from '../types';
import { Connection } from '../../../types';
import { useAppI18n } from '../../../i18n/hooks/useI18n';

interface DirectoryModalProps {
  isOpen: boolean;
  editingDirectory: DirectoryItem | null;
  connections: Connection[];
  form: any;
  onFinish: (values: any) => void;
  onCancel: () => void;
}

/**
 * 目录操作模态框组件
 */
export const DirectoryModal: React.FC<DirectoryModalProps> = ({
  isOpen,
  editingDirectory,
  connections,
  form,
  onFinish,
  onCancel,
}) => {
  const { app, directory } = useAppI18n();
  return (
    <Modal
      title={editingDirectory ? directory.modal.editDirectoryTitle : directory.modal.addDirectoryTitle}
      open={isOpen}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item
          name="name"
          label={directory.modal.directoryNameLabel}
          rules={[{ required: true, message: directory.modal.directoryNameRequired }]}
        >
          <Input placeholder={directory.modal.directoryNamePlaceholder} />
        </Form.Item>

        <Form.Item
          name="connectionIds"
          label={directory.modal.associatedConnectionsLabel}
        >
          <Select
            mode="multiple"
            placeholder={directory.modal.associatedConnectionsPlaceholder}
            options={connections
              .sort((a, b) => a.name.localeCompare(b.name)) // 按名称排序
              .map(conn => ({ 
                label: conn.name, 
                value: conn.id 
              }))}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button onClick={onCancel}>{directory.modal.cancelButton}</Button>
            <Button type="primary" htmlType="submit">
              {editingDirectory ? directory.modal.saveDirectoryButton : directory.modal.addDirectoryButton}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};
