import React from 'react';
import { Form, Input } from 'antd';
import { useAppI18n } from '../../../i18n/hooks/useI18n';

/**
 * 渲染协议特定的表单字段
 */
export const ProtocolFields: React.FC<{ protocolType: string }> = ({ protocolType }) => {
  const { connection } = useAppI18n();
  
  if (protocolType === 's3') {
    return (
      <>
        <Form.Item
          name="bucket"
          label={connection.fields.bucketName}
          rules={[{ required: true, message: connection.fields.bucketNameRequired }]}
        >
          <Input placeholder={connection.fields.bucketNamePlaceholder} />
        </Form.Item>
        <Form.Item
          name="region"
          label={connection.fields.region}
          rules={[{ required: true, message: connection.fields.regionRequired }]}
        >
          <Input placeholder={connection.fields.regionPlaceholder} />
        </Form.Item>
        <Form.Item
          name="endpoint"
          label={connection.fields.endpoint}
        >
          <Input placeholder={connection.fields.endpointPlaceholder} />
        </Form.Item>
        <Form.Item
          name="accessKey"
          label={connection.fields.accessKey}
          rules={[{ required: true, message: connection.fields.accessKeyRequired }]}
        >
          <Input placeholder={connection.fields.accessKeyPlaceholder} />
        </Form.Item>
        <Form.Item
          name="secretKey"
          label={connection.fields.secretKey}
          rules={[{ required: true, message: connection.fields.secretKeyRequired }]}
        >
          <Input.Password placeholder={connection.fields.secretKeyPlaceholder} />
        </Form.Item>
      </>
    );
  }
  
  if (protocolType === 'fs') {
    return (
      <Form.Item
        name="root_dir"
        label={connection.fields.rootDirectory}
        rules={[{ required: true, message: connection.fields.rootDirectoryRequired }]}
      >
        <Input 
          placeholder={connection.fields.rootDirectoryPlaceholder}
          style={{ width: '100%', height: '32px' }}
        />
      </Form.Item>
    );
  }
  
  return null;
};
