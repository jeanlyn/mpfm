import React from 'react';
import { Modal, Form, Input, Select, Button } from 'antd';
import { DirectoryItem } from '../types';
import { Connection } from '../../../types';

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
  return (
    <Modal
      title={editingDirectory ? '编辑目录' : '添加目录'}
      open={isOpen}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item
          name="name"
          label="目录名称"
          rules={[{ required: true, message: '请输入目录名称' }]}
        >
          <Input placeholder="例如：我的目录" />
        </Form.Item>

        <Form.Item
          name="connectionIds"
          label="关联连接"
        >
          <Select
            mode="multiple"
            placeholder="选择关联的连接"
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
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" htmlType="submit">
              {editingDirectory ? '保存目录' : '添加目录'}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};
