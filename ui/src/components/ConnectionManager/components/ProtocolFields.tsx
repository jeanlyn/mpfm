import React from 'react';
import { Form, Input, Select } from 'antd';

/**
 * 渲染协议特定的表单字段
 */
export const ProtocolFields: React.FC<{ protocolType: string }> = ({ protocolType }) => {
  if (protocolType === 's3') {
    return (
      <>
        <Form.Item
          name="bucket"
          label="存储桶名称"
          rules={[{ required: true, message: '请输入存储桶名称' }]}
        >
          <Input placeholder="bucket-name" />
        </Form.Item>
        <Form.Item
          name="region"
          label="区域"
          rules={[{ required: true, message: '请输入区域' }]}
        >
          <Input placeholder="us-east-1" />
        </Form.Item>
        <Form.Item
          name="endpoint"
          label="端点地址"
          rules={[{ required: true, message: '请输入端点地址' }]}
        >
          <Input placeholder="https://s3.amazonaws.com" />
        </Form.Item>
        <Form.Item
          name="accessKey"
          label="访问密钥"
          rules={[{ required: true, message: '请输入访问密钥' }]}
        >
          <Input placeholder="Access Key" />
        </Form.Item>
        <Form.Item
          name="secretKey"
          label="密钥"
          rules={[{ required: true, message: '请输入密钥' }]}
        >
          <Input.Password placeholder="Secret Key" />
        </Form.Item>
      </>
    );
  }
  
  if (protocolType === 'fs') {
    return (
      <Form.Item
        name="root"
        label="根目录"
        rules={[{ required: true, message: '请输入根目录路径' }]}
      >
        <Input placeholder="/path/to/directory" />
      </Form.Item>
    );
  }
  
  return null;
};
