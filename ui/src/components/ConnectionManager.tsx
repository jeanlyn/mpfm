import React, { useState } from 'react';
import {
  Layout,
  Menu,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SettingOutlined,
  DatabaseOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { Connection } from '../types';
import { ApiService } from '../services/api';

const { Sider } = Layout;
const { Title } = Typography;

interface ConnectionManagerProps {
  connections: Connection[];
  currentConnection: Connection | null;
  onConnectionSelect: (connection: Connection) => void;
  onConnectionsChange: () => void;
}

const ConnectionManager: React.FC<ConnectionManagerProps> = ({
  connections,
  currentConnection,
  onConnectionSelect,
  onConnectionsChange,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [connectionToCopy, setConnectionToCopy] = useState<Connection | null>(null);
  const [form] = Form.useForm();
  const [copyForm] = Form.useForm();

  const handleAddConnection = async (values: any) => {
    try {
      const config: Record<string, string> = {};
      
      if (values.protocolType === 's3') {
        config.bucket = values.bucket;
        config.region = values.region;
        config.endpoint = values.endpoint;
        config.access_key = values.accessKey;
        config.secret_key = values.secretKey;

        // 检查 S3 bucket 是否存在
        try {
          const bucketExists = await ApiService.checkS3BucketExists(
            values.bucket,
            values.region,
            values.endpoint || null,
            values.accessKey,
            values.secretKey
          );

          if (!bucketExists) {
            // 显示确认对话框询问是否创建 bucket
            Modal.confirm({
              title: 'Bucket 不存在',
              content: `存储桶 "${values.bucket}" 不存在，是否要创建该存储桶？`,
              okText: '创建',
              cancelText: '取消',
              onOk: async () => {
                try {
                  await ApiService.createS3Bucket(
                    values.bucket,
                    values.region,
                    values.endpoint || null,
                    values.accessKey,
                    values.secretKey
                  );
                  message.success('存储桶创建成功');
                  
                  // 创建成功后继续添加连接
                  await ApiService.addConnection(values.name, values.protocolType, config);
                  message.success('连接添加成功');
                  setIsModalOpen(false);
                  form.resetFields();
                  onConnectionsChange();
                } catch (error) {
                  message.error(`创建存储桶失败: ${error}`);
                }
              },
              onCancel: () => {
                message.info('已取消添加连接');
              }
            });
            return; // 等待用户确认，不继续执行
          }
        } catch (error) {
          message.warning(`检查存储桶状态失败: ${error}，将继续尝试添加连接`);
        }
      } else if (values.protocolType === 'fs') {
        config.root = values.root;
      }

      await ApiService.addConnection(values.name, values.protocolType, config);
      message.success('连接添加成功');
      setIsModalOpen(false);
      form.resetFields();
      onConnectionsChange();
    } catch (error) {
      message.error(`添加连接失败: ${error}`);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    try {
      await ApiService.removeConnection(connectionId);
      message.success('连接删除成功');
      onConnectionsChange();
    } catch (error) {
      message.error(`删除连接失败: ${error}`);
    }
  };

  const handleCopyConnection = async (values: any) => {
    if (!connectionToCopy) return;

    try {
      const config: Record<string, string> = {};
      
      if (values.protocolType === 's3') {
        config.bucket = values.bucket;
        config.region = values.region;
        config.endpoint = values.endpoint;
        config.access_key = values.accessKey;
        config.secret_key = values.secretKey;
        // 检查 S3 bucket 是否存在
        try {
          const bucketExists = await ApiService.checkS3BucketExists(
            values.bucket,
            values.region,
            values.endpoint || null,
            values.accessKey,
            values.secretKey
          );

          if (!bucketExists) {
            // 显示确认对话框询问是否创建 bucket
            Modal.confirm({
              title: 'Bucket 不存在',
              content: `存储桶 "${values.bucket}" 不存在，是否要创建该存储桶？`,
              okText: '创建',
              cancelText: '取消',
              onOk: async () => {
                try {
                  await ApiService.createS3Bucket(
                    values.bucket,
                    values.region,
                    values.endpoint || null,
                    values.accessKey,
                    values.secretKey
                  );
                  message.success('存储桶创建成功');
                  
                  // 创建成功后继续添加连接
                  await ApiService.addConnection(values.name, values.protocolType, config);
                  message.success('连接添加成功');
                  setIsCopyModalOpen(false);
                  setConnectionToCopy(null);
                  copyForm.resetFields();
                  onConnectionsChange();
                } catch (error) {
                  message.error(`创建存储桶失败: ${error}`);
                }
              },
              onCancel: () => {
                message.info('已取消添加连接');
              }
            });
            return; // 等待用户确认，不继续执行
          }
        } catch (error) {
          message.warning(`检查存储桶状态失败: ${error}，将继续尝试添加连接`);
        }
      } else if (values.protocolType === 'fs') {
        config.root = values.root;
      }

      await ApiService.addConnection(values.name, values.protocolType, config);
      message.success('连接复制成功');
      setIsCopyModalOpen(false);
      setConnectionToCopy(null);
      copyForm.resetFields();
      onConnectionsChange();
    } catch (error) {
      message.error(`复制连接失败: ${error}`);
    }
  };

  // 当选择要复制的连接时，设置表单初始值
  const openCopyModal = (connection: Connection) => {
    setConnectionToCopy(connection);
    setIsCopyModalOpen(true);
    
    // 设置表单初始值
    const initialValues = {
      name: `${connection.name} - 副本`,
      protocolType: connection.protocol_type,
      ...connection.config,
      accessKey: connection.config.access_key,
      secretKey: connection.config.secret_key,
    };
    
    copyForm.setFieldsValue(initialValues);
  };

  const menuItems = connections.map((conn) => ({
    key: conn.id,
    icon: <DatabaseOutlined />,
    label: (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{conn.name}</span>
        <div>
          <Popconfirm
            title="确定要删除这个连接吗？"
            onConfirm={(e) => {
              e?.stopPropagation();
              handleDeleteConnection(conn.id);
            }}
            onCancel={(e) => e?.stopPropagation()}
          >
            <DeleteOutlined style={{ color: '#ff4d4f', marginRight: '8px' }} />
          </Popconfirm>
          <Button
            icon={<CopyOutlined />}
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              openCopyModal(conn);
            }}
          />
        </div>
      </div>
    ),
  }));

  return (
    <>
      <Sider width={280} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: '16px' }}>
          <Title level={4} style={{ margin: '0 0 16px 0' }}>
            <SettingOutlined /> 连接管理
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalOpen(true)}
            style={{ width: '100%', marginBottom: '16px' }}
          >
            添加连接
          </Button>
          <Menu
            mode="inline"
            selectedKeys={currentConnection ? [currentConnection.id] : []}
            items={menuItems}
            onSelect={({ key }) => {
              const connection = connections.find((conn) => conn.id === key);
              if (connection) {
                onConnectionSelect(connection);
              }
            }}
          />
        </div>
      </Sider>

      <Modal
        title="添加新连接"
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAddConnection}>
          <Form.Item
            name="name"
            label="连接名称"
            rules={[{ required: true, message: '请输入连接名称' }]}
          >
            <Input placeholder="例如：我的S3存储" />
          </Form.Item>

          <Form.Item
            name="protocolType"
            label="协议类型"
            rules={[{ required: true, message: '请选择协议类型' }]}
          >
            <Select placeholder="选择协议类型">
              <Select.Option value="s3">S3 兼容存储</Select.Option>
              <Select.Option value="fs">本地文件系统</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item dependencies={['protocolType']} noStyle>
            {({ getFieldValue }) => {
              const protocolType = getFieldValue('protocolType');
              
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
            }}
          </Form.Item>

          <Form.Item>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setIsModalOpen(false);
                form.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                添加连接
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="复制连接"
        open={isCopyModalOpen}
        onCancel={() => {
          setIsCopyModalOpen(false);
          setConnectionToCopy(null);
          copyForm.resetFields();
        }}
        footer={null}
      >
        <Form form={copyForm} layout="vertical" onFinish={handleCopyConnection}>
          <Form.Item
            name="name"
            label="连接名称"
            initialValue={connectionToCopy?.name}
            rules={[{ required: true, message: '请输入连接名称' }]}
          >
            <Input placeholder="例如：我的S3存储" />
          </Form.Item>

          <Form.Item
            name="protocolType"
            label="协议类型"
            initialValue={connectionToCopy?.protocol_type}
            rules={[{ required: true, message: '请选择协议类型' }]}
          >
            <Select placeholder="选择协议类型">
              <Select.Option value="s3">S3 兼容存储</Select.Option>
              <Select.Option value="fs">本地文件系统</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item dependencies={['protocolType']} noStyle>
            {({ getFieldValue }) => {
              const protocolType = getFieldValue('protocolType');
              
              if (protocolType === 's3') {
                return (
                  <>
                    <Form.Item
                      name="bucket"
                      label="存储桶名称"
                      initialValue={connectionToCopy?.config.bucket}
                      rules={[{ required: true, message: '请输入存储桶名称' }]}
                    >
                      <Input placeholder="bucket-name" />
                    </Form.Item>
                    <Form.Item
                      name="region"
                      label="区域"
                      initialValue={connectionToCopy?.config.region}
                      rules={[{ required: true, message: '请输入区域' }]}
                    >
                      <Input placeholder="us-east-1" />
                    </Form.Item>
                    <Form.Item
                      name="endpoint"
                      label="端点地址"
                      initialValue={connectionToCopy?.config.endpoint}
                      rules={[{ required: true, message: '请输入端点地址' }]}
                    >
                      <Input placeholder="https://s3.amazonaws.com" />
                    </Form.Item>
                    <Form.Item
                      name="accessKey"
                      label="访问密钥"
                      initialValue={connectionToCopy?.config.access_key}
                      rules={[{ required: true, message: '请输入访问密钥' }]}
                    >
                      <Input placeholder="Access Key" />
                    </Form.Item>
                    <Form.Item
                      name="secretKey"
                      label="密钥"
                      initialValue={connectionToCopy?.config.secret_key}
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
                    initialValue={connectionToCopy?.config.root}
                    rules={[{ required: true, message: '请输入根目录路径' }]}
                  >
                    <Input placeholder="/path/to/directory" />
                  </Form.Item>
                );
              }
              
              return null;
            }}
          </Form.Item>

          <Form.Item>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setIsCopyModalOpen(false);
                setConnectionToCopy(null);
                copyForm.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                复制连接
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ConnectionManager;
