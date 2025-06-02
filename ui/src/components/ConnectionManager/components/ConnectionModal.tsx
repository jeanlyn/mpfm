import React, { useMemo } from 'react';
import { Modal, Form, Input, Select, Button } from 'antd';
import { ModalConfig, MODAL_TYPES } from '../types';
import { DirectoryItem } from '../types';
import { ProtocolFields } from './ProtocolFields';

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
  // 获取模态框标题
  const modalTitle = useMemo(() => {
    switch (modalConfig.type) {
      case MODAL_TYPES.ADD: return '添加新连接';
      case MODAL_TYPES.COPY: return '复制连接';
      case MODAL_TYPES.EDIT: return '编辑连接';
      default: return '连接操作';
    }
  }, [modalConfig.type]);

  // 获取提交按钮文本
  const submitButtonText = useMemo(() => {
    switch (modalConfig.type) {
      case MODAL_TYPES.ADD: return '添加连接';
      case MODAL_TYPES.COPY: return '复制连接';
      case MODAL_TYPES.EDIT: return '编辑连接';
      default: return '确定';
    }
  }, [modalConfig.type]);

  return (
    <Modal
      title={modalTitle}
      open={modalConfig.isOpen}
      onCancel={onCancel}
      footer={null}
      width={600}
      style={{ maxWidth: '90vw' }}
      bodyStyle={{ 
        maxHeight: '70vh', 
        overflowY: 'auto',
        padding: '20px'
      }}
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item
          name="name"
          label="连接名称"
          rules={[{ required: true, message: '请输入连接名称' }]}
        >
          <Input 
            placeholder="例如：我的S3存储" 
            style={{ width: '100%' }}
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item
          name="protocolType"
          label="协议类型"
          rules={[{ required: true, message: '请选择协议类型' }]}
        >
          <Select 
            placeholder="选择协议类型"
            style={{ width: '100%' }}
          >
            <Select.Option value="s3">S3 兼容存储</Select.Option>
            <Select.Option value="fs">本地文件系统</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="directoryId"
          label="选择目录"
        >
          <Select
            placeholder="选择目录"
            options={directories.map(dir => ({ 
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
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" htmlType="submit">
              {submitButtonText}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};
