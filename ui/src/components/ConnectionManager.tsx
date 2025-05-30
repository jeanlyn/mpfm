import React, { useState, useEffect } from 'react';
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
  const [form] = Form.useForm();

  const handleAddConnection = async (values: any) => {
    try {
      const config: Record<string, string> = {};
      
      if (values.protocolType === 's3') {
        config.bucket = values.bucket;
        config.region = values.region;
        config.endpoint = values.endpoint;
        config.access_key = values.accessKey;
        config.secret_key = values.secretKey;
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

  const menuItems = connections.map((conn) => ({
    key: conn.id,
    icon: <DatabaseOutlined />,
    label: (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{conn.name}</span>
        <Popconfirm
          title="确定要删除这个连接吗？"
          onConfirm={(e) => {
            e?.stopPropagation();
            handleDeleteConnection(conn.id);
          }}
          onCancel={(e) => e?.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <DeleteOutlined style={{ color: '#ff4d4f' }} />
        </Popconfirm>
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
    </>
  );
};

export default ConnectionManager;
