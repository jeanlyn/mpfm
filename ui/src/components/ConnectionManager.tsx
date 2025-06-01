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
  CloudOutlined,
  FolderOutlined,
  HddOutlined,
  DragOutlined,
} from '@ant-design/icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import {
  CSS,
} from '@dnd-kit/utilities';
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

// 目录管理相关接口
interface DirectoryItem {
  id: string;
  name: string;
  connectionIds: string[];
  expanded?: boolean;
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
  const [directories, setDirectories] = useState<DirectoryItem[]>([]);
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState(false);
  const [editingDirectory, setEditingDirectory] = useState<DirectoryItem | null>(null);
  const [form] = Form.useForm();
  const [directoryForm] = Form.useForm();
  
  // 拖拽状态
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 拖拽动画配置
  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  // 获取连接类型对应的图标
  const getConnectionIcon = useCallback((protocolType: string) => {
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
  }, []);

  // 从 localStorage 加载目录配置
  const loadDirectories = useCallback(() => {
    try {
      const saved = localStorage.getItem('mpfm_directories');
      if (saved) {
        const parsed = JSON.parse(saved);
        // 确保默认分组包含所有连接
        const updatedDirectories = parsed.map((dir: DirectoryItem) => {
          if (dir.id === 'default') {
            return {
              ...dir,
              connectionIds: connections.map(conn => conn.id) // 始终包含所有连接
            };
          }
          return dir;
        });
        setDirectories(updatedDirectories);
      } else {
        // 初始化默认目录
        const defaultDirectories: DirectoryItem[] = [
          {
            id: 'default',
            name: '默认分组',
            connectionIds: connections.map(conn => conn.id),
            expanded: true
          }
        ];
        setDirectories(defaultDirectories);
        localStorage.setItem('mpfm_directories', JSON.stringify(defaultDirectories));
      }
    } catch (error) {
      console.error('加载目录配置失败:', error);
      setDirectories([]);
    }
  }, [connections]);

  // 保存目录配置到 localStorage
  const saveDirectories = useCallback((dirs: DirectoryItem[]) => {
    try {
      // 确保默认分组始终包含所有连接
      const updatedDirs = dirs.map(dir => {
        if (dir.id === 'default') {
          return {
            ...dir,
            connectionIds: connections.map(conn => conn.id) // 始终包含所有连接
          };
        }
        return dir;
      });
      
      localStorage.setItem('mpfm_directories', JSON.stringify(updatedDirs));
      setDirectories(updatedDirs);
    } catch (error) {
      console.error('保存目录配置失败:', error);
      message.error('保存目录配置失败');
    }
  }, [connections]);

  // 初始化时加载目录
  React.useEffect(() => {
    loadDirectories();
  }, [loadDirectories]);

  // 目录管理相关函数
  const handleDirectoryToggle = useCallback((directoryId: string) => {
    const newDirectories = directories.map(dir => 
      dir.id === directoryId ? { ...dir, expanded: !dir.expanded } : dir
    );
    saveDirectories(newDirectories);
  }, [directories, saveDirectories]);

  const handleAddDirectory = useCallback(() => {
    setEditingDirectory(null);
    setIsDirectoryModalOpen(true);
    directoryForm.resetFields();
  }, [directoryForm]);

  const handleEditDirectory = useCallback((directory: DirectoryItem) => {
    setEditingDirectory(directory);
    setIsDirectoryModalOpen(true);
    directoryForm.setFieldsValue({
      name: directory.name,
      connectionIds: directory.connectionIds
    });
  }, [directoryForm]);

  const handleDeleteDirectory = useCallback((directoryId: string) => {
    if (directoryId === 'default') {
      message.warning('默认分组无法删除');
      return;
    }
    const newDirectories = directories.filter(dir => dir.id !== directoryId);
    saveDirectories(newDirectories);
    message.success('目录删除成功');
  }, [directories, saveDirectories]);

  const handleDirectoryOperation = useCallback((values: any) => {
    try {
      if (editingDirectory) {
        // 编辑目录
        const newDirectories = directories.map(dir =>
          dir.id === editingDirectory.id
            ? { ...dir, name: values.name, connectionIds: values.connectionIds || [] }
            : dir
        );
        saveDirectories(newDirectories);
        message.success('目录编辑成功');
      } else {
        // 添加目录
        const newDirectory: DirectoryItem = {
          id: `dir_${Date.now()}`,
          name: values.name,
          connectionIds: values.connectionIds || [],
          expanded: true
        };
        saveDirectories([...directories, newDirectory]);
        message.success('目录添加成功');
      }
      setIsDirectoryModalOpen(false);
      setEditingDirectory(null);
      directoryForm.resetFields();
    } catch (error) {
      message.error('目录操作失败');
    }
  }, [editingDirectory, directories, saveDirectories, directoryForm]);

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
      let newConnectionId: string | null = null;
      
      switch (type) {
        case MODAL_TYPES.ADD:
          const addResult = await ApiService.addConnection(values.name, values.protocolType, config);
          newConnectionId = addResult?.id || `conn_${Date.now()}`;
          message.success('连接添加成功');
          break;
        case MODAL_TYPES.COPY:
          const copyResult = await ApiService.addConnection(values.name, values.protocolType, config);
          newConnectionId = copyResult?.id || `conn_${Date.now()}`;
          message.success('连接复制成功');
          break;
        case MODAL_TYPES.EDIT:
          if (!connection) return;
          await ApiService.updateConnection(connection.id, values.name, values.protocolType, config);
          message.success('连接编辑成功');
          break;
      }

      // 处理目录关联
      if (newConnectionId) {
        if (type === MODAL_TYPES.ADD && values.directoryId) {
          // 新建连接：添加到指定目录
          const newDirectories = directories.map(dir => {
            if (dir.id === values.directoryId) {
              return {
                ...dir,
                connectionIds: [...dir.connectionIds, newConnectionId]
              };
            }
            return dir;
          });
          saveDirectories(newDirectories);
        } else if (type === MODAL_TYPES.COPY && connection) {
          // 复制连接：保留原连接的目录信息
          const originalConnectionDirectories = directories.filter(dir => 
            dir.connectionIds.includes(connection.id)
          );
          
          if (originalConnectionDirectories.length > 0) {
            const newDirectories = directories.map(dir => {
              // 如果原连接在这个目录中，也将新连接添加到此目录
              if (dir.connectionIds.includes(connection.id)) {
                return {
                  ...dir,
                  connectionIds: [...dir.connectionIds, newConnectionId]
                };
              }
              return dir;
            });
            saveDirectories(newDirectories);
            
            const dirNames = originalConnectionDirectories.map(dir => dir.name).join('、');
            message.success(`连接复制成功，已添加到目录：${dirNames}`);
          } else {
            message.success('连接复制成功');
          }
        }
      }

      closeModal();
      onConnectionsChange();
    } catch (error) {
      const operationName = type === MODAL_TYPES.ADD ? '添加' : type === MODAL_TYPES.COPY ? '复制' : '编辑';
      message.error(`${operationName}连接失败: ${error}`);
    }
  }, [modalConfig, buildConfig, checkAndCreateS3Bucket, onConnectionsChange, directories, saveDirectories]);

  // 打开模态框的统一方法
  const openModal = useCallback((type: ModalType, connection?: Connection) => {
    setModalConfig({ isOpen: true, type, connection });
    
    // 设置表单初始值
    let initialValues: any = {};
    
    if (type === MODAL_TYPES.COPY && connection) {
      // 找到原连接所在的目录
      const connectionDirectories = directories.filter(dir => 
        dir.connectionIds.includes(connection.id)
      );
      // 优先选择非默认目录，如果没有则选择默认目录
      const preferredDirectory = connectionDirectories.find(dir => dir.id !== 'default') || 
                                connectionDirectories.find(dir => dir.id === 'default');
      
      initialValues = {
        name: `${connection.name} - 副本`,
        protocolType: connection.protocol_type,
        directoryId: preferredDirectory?.id, // 设置目录ID
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
  }, [form, directories]);

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
  const renderProtocolFields = useCallback((protocolType: string) => {
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

  // 根据目录结构创建菜单项（更新为支持拖拽）
  const createMenuItems = useCallback(() => {
    if (collapsed) {
      // 折叠状态：只显示连接图标
      return connections.map((conn) => ({
        key: conn.id,
        icon: (
          <Tooltip title={`${conn.name} (${conn.protocol_type.toUpperCase()})`} placement="right">
            {getConnectionIcon(conn.protocol_type)}
          </Tooltip>
        ),
        label: null,
      }));
    }

    // 展开状态：按目录分组显示，支持拖拽
    const menuItems: any[] = [];
    
    // 构建目录管理的子菜单项
    const directoryChildren = directories.map((directory) => {
      const directoryConnections = connections.filter(conn => 
        directory.connectionIds.includes(conn.id)
      );

      return {
        key: `dir-${directory.id}`,
        icon: directory.expanded ? <FolderOutlined /> : <FolderOutlined />,
        label: (
          <DroppableDirectory
            directory={directory}
            onToggle={() => handleDirectoryToggle(directory.id)}
            onEdit={() => handleEditDirectory(directory)}
            onDelete={() => handleDeleteDirectory(directory.id)}
          >
            {directory.expanded && (
              <div style={{ paddingLeft: '16px', marginTop: '8px' }}>
                <SortableContext
                  items={directoryConnections.map(conn => conn.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {directoryConnections.map((conn) => (
                    <div
                      key={conn.id}
                      onClick={() => onConnectionSelect(conn)}
                      style={{
                        marginBottom: '4px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        backgroundColor: currentConnection?.id === conn.id ? '#e6f7ff' : 'transparent',
                        border: currentConnection?.id === conn.id ? '1px solid #1890ff' : '1px solid transparent',
                      }}
                    >
                      <DraggableConnection
                        connection={conn}
                        directoryId={directory.id}
                        onEdit={() => openModal(MODAL_TYPES.EDIT, conn)}
                        onCopy={() => openModal(MODAL_TYPES.COPY, conn)}
                        onDelete={() => handleDeleteConnection(conn.id)}
                      />
                    </div>
                  ))}
                </SortableContext>
              </div>
            )}
          </DroppableDirectory>
        ),
        children: [] // 清空默认的 children，因为我们在 label 中自定义渲染
      };
    });

    // 添加目录管理作为根节点
    if (!collapsed) {
      menuItems.push({
        key: 'directory-management',
        icon: <FolderOutlined />,
        label: (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            fontWeight: 'bold',
            color: '#1890ff'
          }}>
            <span>目录管理</span>
            <Tooltip title="添加目录">
              <Button
                icon={<PlusOutlined />}
                size="small"
                type="text"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddDirectory();
                }}
                style={{ 
                  padding: '0 4px',
                  minWidth: 'unset',
                  height: '20px'
                }}
              />
            </Tooltip>
          </div>
        ),
        children: directoryChildren
      });
    }

    return menuItems;
  }, [
    collapsed, 
    connections, 
    directories, 
    currentConnection,
    getConnectionIcon, 
    handleDirectoryToggle, 
    handleAddDirectory, 
    handleEditDirectory, 
    handleDeleteDirectory, 
    openModal, 
    handleDeleteConnection,
    onConnectionSelect
  ]);

  // 拖拽事件处理
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const connectionId = active.id as string;
    const connection = connections.find(conn => conn.id === connectionId);
    
    if (connection) {
      setActiveConnection(connection);
    }
  }, [connections]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    // 如果拖拽到目录上
    if (overId.startsWith('dir-')) {
      const directoryId = overId.replace('dir-', '');
      const activeConnectionId = activeId;
      
      // 检查连接是否已经在目标目录中
      const targetDirectory = directories.find(dir => dir.id === directoryId);
      if (targetDirectory && !targetDirectory.connectionIds.includes(activeConnectionId)) {
        // 临时视觉反馈（可以添加样式变化）
        console.log(`准备将连接 ${activeConnectionId} 移动到目录 ${directoryId}`);
      }
    }
  }, [directories]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveConnection(null);
    
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    // 如果拖拽到目录上
    if (overId.startsWith('dir-')) {
      const directoryId = overId.replace('dir-', '');
      const connectionId = activeId;
      
      // 找到连接和目标目录
      const connection = connections.find(conn => conn.id === connectionId);
      const targetDirectory = directories.find(dir => dir.id === directoryId);
      
      if (!connection || !targetDirectory) return;
      
      // 检查连接是否已经在目标目录
      if (targetDirectory.connectionIds.includes(connectionId)) {
        message.info(`连接 "${connection.name}" 已在目录 "${targetDirectory.name}" 中`);
        return;
      }
      
      // 更新目录配置
      const newDirectories = directories.map(dir => {
        if (dir.id === directoryId) {
          // 添加到目标目录
          return {
            ...dir,
            connectionIds: [...dir.connectionIds, connectionId]
          };
        } else if (dir.id !== 'default') {
          // 从其他非默认目录中移除
          return {
            ...dir,
            connectionIds: dir.connectionIds.filter(id => id !== connectionId)
          };
        }
        // 默认目录保持不变，不移除任何连接
        return dir;
      });
      
      saveDirectories(newDirectories);
      message.success(`连接 "${connection.name}" 已添加到目录 "${targetDirectory.name}"`);
    }
  }, [connections, directories, saveDirectories]);

  // 创建可拖拽的连接组件
  const DraggableConnection: React.FC<{
    connection: Connection;
    directoryId: string;
    onEdit: () => void;
    onCopy: () => void;
    onDelete: () => void;
  }> = ({ connection, directoryId, onEdit, onCopy, onDelete }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: connection.id,
      data: {
        type: 'connection',
        connection,
        directoryId,
      },
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className="draggable-connection"
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          width: '100%',
          minHeight: '32px',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: isDragging ? '#f0f0f0' : 'transparent',
          border: isDragging ? '1px dashed #d9d9d9' : '1px solid transparent',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <div {...listeners} style={{ cursor: 'grab', marginRight: '8px', color: '#999' }}>
              <DragOutlined />
            </div>
            {getConnectionIcon(connection.protocol_type)}
            <Tooltip title={`${connection.name} (${connection.protocol_type.toUpperCase()})`} placement="top">
              <span style={{ 
                flex: '1', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                marginLeft: '8px',
                minWidth: '0'
              }}>
                {connection.name}
              </span>
            </Tooltip>
          </div>
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
                  onEdit();
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
                  onCopy();
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
                  onDelete();
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
        </div>
      </div>
    );
  };

  // 创建可拖拽放置的目录组件
  const DroppableDirectory: React.FC<{
    directory: DirectoryItem;
    children: React.ReactNode;
    onToggle: () => void;
    onEdit: () => void;
    onDelete: () => void;
  }> = ({ directory, children, onToggle, onEdit, onDelete }) => {
    const {
      setNodeRef,
      isOver,
    } = useSortable({
      id: `dir-${directory.id}`,
      data: {
        type: 'directory',
        directory,
      },
    });

    return (
      <div
        ref={setNodeRef}
        style={{
          backgroundColor: isOver ? '#e6f7ff' : 'transparent',
          border: isOver ? '2px dashed #1890ff' : '2px solid transparent',
          borderRadius: '4px',
          padding: '4px',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          fontWeight: '500',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: isOver ? '#f0f9ff' : 'transparent',
        }}>
          <span 
            onClick={onToggle}
            style={{ flex: 1, cursor: 'pointer' }}
          >
            {directory.name} ({directory.connectionIds.length})
          </span>
          <div style={{ display: 'flex', gap: '2px' }}>
            <Tooltip title="新建连接到此目录">
              <Button
                icon={<PlusOutlined />}
                size="small"
                type="text"
                onClick={(e) => {
                  e.stopPropagation();
                  // 打开新建连接模态框，并预选当前目录
                  openModal(MODAL_TYPES.ADD);
                  // 设置表单的目录字段
                  setTimeout(() => {
                    form.setFieldsValue({ directoryId: directory.id });
                  }, 100);
                }}
                style={{ 
                  padding: '0 2px',
                  minWidth: 'unset',
                  height: '20px',
                  fontSize: '12px',
                  color: '#52c41a'
                }}
              />
            </Tooltip>
            <Tooltip title="编辑目录">
              <Button
                icon={<EditOutlined />}
                size="small"
                type="text"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                style={{ 
                  padding: '0 2px',
                  minWidth: 'unset',
                  height: '20px',
                  fontSize: '12px'
                }}
              />
            </Tooltip>
            {directory.id !== 'default' && (
              <Tooltip title="删除目录">
                <Popconfirm
                  title="确定要删除这个目录吗？"
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    onDelete();
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <Button
                    icon={<DeleteOutlined />}
                    size="small"
                    type="text"
                    onClick={(e) => e.stopPropagation()}
                    style={{ 
                      padding: '0 2px',
                      minWidth: 'unset',
                      height: '20px',
                      fontSize: '12px',
                      color: '#ff4d4f'
                    }}
                  />
                </Popconfirm>
              </Tooltip>
            )}
          </div>
        </div>
        {children}
      </div>
    );
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
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
            {collapsed ? (
              // 折叠状态：使用传统 Menu 组件
              <Menu
                mode="inline"
                selectedKeys={currentConnection ? [currentConnection.id] : []}
                items={createMenuItems()}
                onSelect={({ key }) => {
                  const connection = connections.find((conn) => conn.id === key);
                  if (connection) {
                    onConnectionSelect(connection);
                  }
                }}
                style={{
                  border: 'none',
                  width: '48px'
                }}
                inlineCollapsed={collapsed}
              />
            ) : (
              // 展开状态：使用自定义拖拽布局
              <div style={{ marginTop: '8px' }}>
                {directories.map((directory) => {
                  const directoryConnections = connections.filter(conn => 
                    directory.connectionIds.includes(conn.id)
                  );

                  return (
                    <div key={directory.id} style={{ marginBottom: '12px' }}>
                      <DroppableDirectory
                        directory={directory}
                        onToggle={() => handleDirectoryToggle(directory.id)}
                        onEdit={() => handleEditDirectory(directory)}
                        onDelete={() => handleDeleteDirectory(directory.id)}
                      >
                        {directory.expanded && (
                          <div style={{ paddingLeft: '8px', marginTop: '8px' }}>
                            <SortableContext
                              items={directoryConnections.map(conn => conn.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {directoryConnections.map((conn) => (
                                <div
                                  key={conn.id}
                                  onClick={() => onConnectionSelect(conn)}
                                  style={{
                                    marginBottom: '4px',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    backgroundColor: currentConnection?.id === conn.id ? '#e6f7ff' : 'transparent',
                                    border: currentConnection?.id === conn.id ? '1px solid #1890ff' : '1px solid transparent',
                                    transition: 'all 0.2s ease',
                                  }}
                                >
                                  <DraggableConnection
                                    connection={conn}
                                    directoryId={directory.id}
                                    onEdit={() => openModal(MODAL_TYPES.EDIT, conn)}
                                    onCopy={() => openModal(MODAL_TYPES.COPY, conn)}
                                    onDelete={() => handleDeleteConnection(conn.id)}
                                  />
                                </div>
                              ))}
                            </SortableContext>
                          </div>
                        )}
                      </DroppableDirectory>
                    </div>
                  );
                })}
                
                {/* 添加新目录按钮 */}
                <div style={{ 
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px dashed #d9d9d9',
                  textAlign: 'center',
                  color: '#666',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={handleAddDirectory}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#1890ff';
                  e.currentTarget.style.color = '#1890ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#d9d9d9';
                  e.currentTarget.style.color = '#666';
                }}
                >
                  <PlusOutlined /> 添加新目录
                </div>
              </div>
            )}
          </div>
        </Sider>

        {/* 拖拽覆盖层 */}
        <DragOverlay dropAnimation={dropAnimation}>
          {activeConnection ? (
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#fff',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              border: '1px solid #d9d9d9',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: '200px',
            }}>
              {getConnectionIcon(activeConnection.protocol_type)}
              <span style={{ fontWeight: 'medium' }}>{activeConnection.name}</span>
              <DragOutlined style={{ color: '#999', marginLeft: 'auto' }} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
              return renderProtocolFields(protocolType);
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

      {/* 目录管理模态框 */}
      <Modal
        title={editingDirectory ? '编辑目录' : '添加目录'}
        open={isDirectoryModalOpen}
        onCancel={() => setIsDirectoryModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={directoryForm} layout="vertical" onFinish={handleDirectoryOperation}>
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
              options={connections.map(conn => ({ 
                label: conn.name, 
                value: conn.id 
              }))}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button onClick={() => setIsDirectoryModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingDirectory ? '保存目录' : '添加目录'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ConnectionManager;
