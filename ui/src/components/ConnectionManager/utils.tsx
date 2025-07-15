import { CloudOutlined, HddOutlined, DatabaseOutlined } from '@ant-design/icons';

/**
 * 获取连接类型对应的图标
 */
export const getConnectionIcon = (protocolType: string) => {
  switch (protocolType) {
    case 's3':
      return <CloudOutlined style={{ color: '#ff9500' }} />;
    case 'fs':
      return <HddOutlined style={{ color: '#52c41a' }} />;
    case 'ftp':
      return <DatabaseOutlined style={{ color: '#1890ff' }} />;
    case 'sftp':
      return <DatabaseOutlined style={{ color: '#722ed1' }} />;
    default:
      return <DatabaseOutlined style={{ color: '#8c8c8c' }} />;
  }
};

/**
 * 构建连接配置对象
 */
export const buildConfig = (values: any): Record<string, string> => {
  const config: Record<string, string> = {};
  
  if (values.protocolType === 's3') {
    config.bucket = values.bucket;
    config.region = values.region;
    config.endpoint = values.endpoint;
    config.access_key = values.accessKey;
    config.secret_key = values.secretKey;
  } else if (values.protocolType === 'fs') {
    config.root_dir = values.root_dir;
  } else if (values.protocolType === 'ftp') {
    config.host = values.host;
    config.port = values.port?.toString() || '21';
    config.username = values.username;
    config.password = values.password;
    config.root_dir = values.root_dir || '/';
    config.secure = values.secure ? 'true' : 'false';
  }
  
  return config;
};
