import React, { useState, useCallback, useMemo } from 'react';
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
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SettingOutlined,
  DatabaseOutlined,
  CopyOutlined,
  EditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Connection } from '../types';
import { ApiService } from '../services/api';

const { Sider } = Layout;
const { Title } = Typography;

// 提取常量
const MODAL_TYPES = {
  ADD: 'add',
  COPY: 'copy',
  EDIT: 'edit'
} as const;

type ModalType = typeof MODAL_TYPES[keyof typeof MODAL_TYPES];

interface ModalConfig {
  isOpen: boolean;
  type: ModalType;
  connection?: Connection | null;
}

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
  const [collapsed, setCollapsed] = useState(false);
  const [modalConfig, setModalConfig] = useState<ModalConfig>({
    isOpen: false,
    type: MODAL_TYPES.ADD
  });
  const [form] = Form.useForm();

  // 提取配置转换逻辑
  const buildConfig = useCallback((values: any): Record<string, string> => {
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
    
    return config;
  }, []);

  // 提取 S3 bucket 检查逻辑
  const checkAndCreateS3Bucket = useCallback(async (values: any): Promise<boolean> => {
    if (values.protocolType !== 's3') return true;

    try {
      const bucketExists = await ApiService.checkS3BucketExists(
        values.bucket,
        values.region,
        values.endpoint || null,
        values.accessKey,
        values.secretKey
      );

      if (!bucketExists) {
        return new Promise((resolve) => {
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
                resolve(true);
              } catch (error) {
                message.error(`创建存储桶失败: ${error}`);
                resolve(false);
              }
            },
            onCancel: () => {
              message.info('已取消操作');
              resolve(false);
            }
          });
        });
      }
      return true;
    } catch (error) {
      message.warning(`检查存储桶状态失败: ${error}，将继续尝试操作`);
      return true;
    }
  }, []);

  // 统一的连接操作处理
  const handleConnectionOperation = useCallback(async (values: any) => {
    const { type, connection } = modalConfig;
    
    try {
      const config = buildConfig(values);
      
      // 检查并创建 S3 bucket（编辑时不需要）
      if (type !== MODAL_TYPES.EDIT) {
        const bucketReady = await checkAndCreateS3Bucket(values);
        if (!bucketReady) return;
      }

      // 执行对应的操作
      switch (type) {
        case MODAL_TYPES.ADD:
          await ApiService.addConnection(values.name, values.protocolType, config);
          message.success('连接添加成功');
          break;
        case MODAL_TYPES.COPY:
          await ApiService.addConnection(values.name, values.protocolType, config);
          message.success('连接复制成功');
          break;
        case MODAL_TYPES.EDIT:
          if (!connection) return;
          await ApiService.updateConnection(connection.id, values.name, values.protocolType, config);
          message.success('连接编辑成功');
          break;
      }

      closeModal();
      onConnectionsChange();
    } catch (error) {
      const operationName = type === MODAL_TYPES.ADD ? '添加' : type === MODAL_TYPES.COPY ? '复制' : '编辑';
      message.error(`${operationName}连接失败: ${error}`);
    }
  }, [modalConfig, buildConfig, checkAndCreateS3Bucket, onConnectionsChange]);

  // 打开模态框的统一方法
  const openModal = useCallback((type: ModalType, connection?: Connection) => {
    setModalConfig({ isOpen: true, type, connection });
    
    // 设置表单初始值
    let initialValues: any = {};
    
    if (type === MODAL_TYPES.COPY && connection) {
      initialValues = {
        name: `${connection.name} - 副本`,
        protocolType: connection.protocol_type,
        ...connection.config,
        accessKey: connection.config.access_key,
        secretKey: connection.config.secret_key,
      };
    } else if (type === MODAL_TYPES.EDIT && connection) {
      initialValues = {
        name: connection.name,
        protocolType: connection.protocol_type,
        ...connection.config,
        accessKey: connection.config.access_key,
        secretKey: connection.config.secret_key,
      };
    }
    
    form.setFieldsValue(initialValues);
  }, [form]);

  // 关闭模态框
  const closeModal = useCallback(() => {
    setModalConfig({ isOpen: false, type: MODAL_TYPES.ADD });
    form.resetFields();
  }, [form]);

  // 删除连接处理
  const handleDeleteConnection = useCallback(async (connectionId: string) => {
    try {
      await ApiService.removeConnection(connectionId);
      message.success('连接删除成功');
      onConnectionsChange();
    } catch (error) {
      message.error(`删除连接失败: ${error}`);
    }
  }, [onConnectionsChange]);

  // 获取模态框标题
  const getModalTitle = useMemo(() => {
    switch (modalConfig.type) {
      case MODAL_TYPES.ADD: return '添加新连接';
      case MODAL_TYPES.COPY: return '复制连接';
      case MODAL_TYPES.EDIT: return '编辑连接';
      default: return '连接操作';
    }
  }, [modalConfig.type]);

  // 获取提交按钮文本
  const getSubmitButtonText = useMemo(() => {
    switch (modalConfig.type) {
      case MODAL_TYPES.ADD: return '添加连接';
      case MODAL_TYPES.COPY: return '复制连接';
      case MODAL_TYPES.EDIT: return '编辑连接';
      default: return '确定';
    }
  }, [modalConfig.type]);

  // 渲染协议特定的表单字段
  const renderProtocolFields = useCallback((protocolType: string, connection?: Connection) => {
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
  }, []);

  // 在折叠状态下创建简化的菜单项
  const collapsedMenuItems = connections.map((conn) => ({
    key: conn.id,
    icon: (
      <Tooltip title={conn.name} placement="right">
        <DatabaseOutlined />
      </Tooltip>
    ),
    label: null, // 折叠时不显示标签
  }));

  // 在展开状态下创建完整的菜单项
  const expandedMenuItems = connections.map((conn) => ({
    key: conn.id,
    icon: <DatabaseOutlined />,
    label: (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        width: '100%',
        minHeight: '32px'
      }}>
        <Tooltip title={conn.name} placement="top">
          <span style={{ 
            flex: '1', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap',
            marginRight: '8px',
            minWidth: '0'
          }}>
            {conn.name}
          </span>
        </Tooltip>
        {!collapsed && (
          <div style={{ 
            display: 'flex', 
            gap: '4px', 
            flexShrink: 0
          }}>
            <Tooltip title="编辑连接">
              <Button
                icon={<EditOutlined />}
                size="small"
                type="text"
                onClick={(e) => {
                  e.stopPropagation();
                  openModal(MODAL_TYPES.EDIT, conn);
                }}
                style={{ 
                  padding: '0 4px',
                  minWidth: 'unset',
                  height: '24px',
                  color: '#1890ff'
                }}
              />
            </Tooltip>
            <Tooltip title="复制连接">
              <Button
                icon={<CopyOutlined />}
                size="small"
                type="text"
                onClick={(e) => {
                  e.stopPropagation();
                  openModal(MODAL_TYPES.COPY, conn);
                }}
                style={{ 
                  padding: '0 4px',
                  minWidth: 'unset',
                  height: '24px',
                  color: '#52c41a'
                }}
              />
            </Tooltip>
            <Tooltip title="删除连接">
              <Popconfirm
                title="确定要删除这个连接吗？"
                onConfirm={(e) => {
                  e?.stopPropagation();
                  handleDeleteConnection(conn.id);
                }}
                onCancel={(e) => e?.stopPropagation()}
              >
                <Button
                  icon={<DeleteOutlined />}
                  size="small"
                  type="text"
                  onClick={(e) => e.stopPropagation()}
                  style={{ 
                    padding: '0 4px',
                    minWidth: 'unset',
                    height: '24px',
                    color: '#ff4d4f'
                  }}
                />
              </Popconfirm>
            </Tooltip>
          </div>
        )}
      </div>
    ),
  }));

  return (
    <>
      <Sider 
        width={collapsed ? 80 : 280} 
        collapsed={collapsed}
        collapsible
        trigger={null}
        style={{ 
          background: '#fff', 
          borderRight: '1px solid #f0f0f0',
          transition: 'all 0.2s'
        }}
      >
        <div style={{ padding: collapsed ? '16px 8px' : '16px' }}>
          {/* 标题和折叠按钮 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '16px',
            height: '32px'
          }}>
            {!collapsed && (
              <Title level={4} style={{ margin: 0, fontSize: '16px' }}>
                <SettingOutlined /> 连接管理
              </Title>
            )}
            <Tooltip title={collapsed ? "展开面板" : "收起面板"}>
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{
                  fontSize: '16px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              />
            </Tooltip>
          </div>

          {/* 添加连接按钮 */}
          <Tooltip title={collapsed ? "添加连接" : ""} placement="right">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openModal(MODAL_TYPES.ADD)}
              style={{ 
                width: '100%', 
                marginBottom: '16px',
                ...(collapsed && { 
                  width: '48px', 
                  height: '48px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                })
              }}
            >
              {!collapsed && '添加连接'}
            </Button>
          </Tooltip>

          {/* 连接列表 */}
          <Menu
            mode="inline"
            selectedKeys={currentConnection ? [currentConnection.id] : []}
            items={collapsed ? collapsedMenuItems : expandedMenuItems}
            onSelect={({ key }) => {
              const connection = connections.find((conn) => conn.id === key);
              if (connection) {
                onConnectionSelect(connection);
              }
            }}
            style={{
              border: 'none',
              ...(collapsed && { width: '48px' })
            }}
            inlineCollapsed={collapsed}
          />
        </div>
      </Sider>

      {/* 统一的模态框 */}
      <Modal
        title={getModalTitle}
        open={modalConfig.isOpen}
        onCancel={closeModal}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleConnectionOperation}>
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
              return renderProtocolFields(protocolType, modalConfig.connection || undefined);
            }}
          </Form.Item>

          <Form.Item>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button onClick={closeModal}>取消</Button>
              <Button type="primary" htmlType="submit">
                {getSubmitButtonText}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ConnectionManager;
