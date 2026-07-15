import React from 'react';
import { Form, Checkbox } from 'antd';
import { AppInput } from '../../common';
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
          <AppInput placeholder={connection.fields.bucketNamePlaceholder} />
        </Form.Item>
        <Form.Item
          name="region"
          label={connection.fields.region}
          rules={[{ required: true, message: connection.fields.regionRequired }]}
        >
          <AppInput placeholder={connection.fields.regionPlaceholder} />
        </Form.Item>
        <Form.Item
          name="endpoint"
          label={connection.fields.endpoint}
        >
          <AppInput placeholder={connection.fields.endpointPlaceholder} />
        </Form.Item>
        <Form.Item
          name="accessKey"
          label={connection.fields.accessKey}
          rules={[{ required: true, message: connection.fields.accessKeyRequired }]}
        >
          <AppInput placeholder={connection.fields.accessKeyPlaceholder} />
        </Form.Item>
        <Form.Item
          name="secretKey"
          label={connection.fields.secretKey}
          rules={[{ required: true, message: connection.fields.secretKeyRequired }]}
        >
          <AppInput.Password placeholder={connection.fields.secretKeyPlaceholder} />
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
        <AppInput 
          placeholder={connection.fields.rootDirectoryPlaceholder}
          style={{ width: '100%', height: '32px' }}
        />
      </Form.Item>
    );
  }

  if (protocolType === 'ftp') {
    return (
      <>
        
        <Form.Item
          name="host"
          label={connection.fields.host}
          rules={[{ required: true, message: connection.fields.hostRequired }]}
          tooltip={connection.fields.hostTooltip}
        >
          <AppInput 
            placeholder={connection.fields.hostPlaceholder} 
            addonBefore="ftp://"
          />
        </Form.Item>
        
        <Form.Item
          name="port"
          label={connection.fields.port}
          tooltip={connection.fields.portTooltip}
        >
          <AppInput 
            placeholder={connection.fields.portPlaceholder} 
            type="number"
          />
        </Form.Item>
        
        <Form.Item
          name="username"
          label={connection.fields.username}
          rules={[{ required: true, message: connection.fields.usernameRequired }]}
          tooltip={connection.fields.usernameTooltip}
        >
          <AppInput 
            placeholder={connection.fields.usernamePlaceholder}
            autoComplete="username"
          />
        </Form.Item>
        
        <Form.Item
          name="password"
          label={connection.fields.password}
          rules={[{ required: true, message: connection.fields.passwordRequired }]}
          tooltip={connection.fields.passwordTooltip}
        >
          <AppInput.Password 
            placeholder={connection.fields.passwordPlaceholder}
            autoComplete="current-password"
          />
        </Form.Item>
        
        <Form.Item
          name="root_dir"
          label={connection.fields.rootDirectory}
          tooltip={connection.fields.rootDirectoryTooltip}
        >
          <AppInput 
            placeholder={connection.fields.rootDirectoryPlaceholder}
            addonBefore="/"
          />
        </Form.Item>
        
        <Form.Item
          name="secure"
          label={connection.fields.secureConnection}
          valuePropName="checked"
          tooltip={connection.fields.secureConnectionTooltip}
        >
          <Checkbox>{connection.fields.secureConnection}</Checkbox>
        </Form.Item>
      </>
    );
  }
  
  return null;
};
