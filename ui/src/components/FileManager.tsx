import React, { useState, useEffect } from 'react';
import {
  Layout,
  Table,
  Button,
  Breadcrumb,
  message,
  Modal,
  Input,
  Upload,
  Typography,
  Space,
  Popconfirm,
} from 'antd';
import {
  FolderOutlined,
  FileOutlined,
  UploadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  PlusOutlined,
  HomeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { open, save } from '@tauri-apps/api/dialog';
import { Connection, FileInfo } from '../types';
import { ApiService } from '../services/api';

const { Content } = Layout;
const { Title } = Typography;

interface FileManagerProps {
  connection: Connection | null;
}

const FileManager: React.FC<FileManagerProps> = ({ connection }) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [loading, setLoading] = useState(false);
  const [createDirModalOpen, setCreateDirModalOpen] = useState(false);
  const [newDirName, setNewDirName] = useState('');

  useEffect(() => {
    if (connection) {
      loadFiles('/');
    }
  }, [connection]);

  const loadFiles = async (path: string) => {
    if (!connection) return;
    
    setLoading(true);
    try {
      const fileList = await ApiService.listFiles(connection.id, path);
      setFiles(fileList);
      setCurrentPath(path);
    } catch (error) {
      message.error(`加载文件列表失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileDoubleClick = (file: FileInfo) => {
    if (file.is_dir) {
      const newPath = file.path.endsWith('/') ? file.path : file.path + '/';
      loadFiles(newPath);
    }
  };

  const handleUpload = async () => {
    if (!connection) return;

    try {
      const selected = await open({
        multiple: false,
        title: '选择要上传的文件',
      });

      if (selected && typeof selected === 'string') {
        const fileName = selected.split('/').pop() || 'uploaded_file';
        const remotePath = currentPath.endsWith('/') 
          ? currentPath + fileName 
          : currentPath + '/' + fileName;

        await ApiService.uploadFile(connection.id, selected, remotePath);
        message.success('文件上传成功');
        loadFiles(currentPath);
      }
    } catch (error) {
      message.error(`文件上传失败: ${error}`);
    }
  };

  const handleDownload = async (file: FileInfo) => {
    if (!connection || file.is_dir) return;

    try {
      const savePath = await save({
        defaultPath: file.name,
        title: '选择保存位置',
      });

      if (savePath) {
        await ApiService.downloadFile(connection.id, file.path, savePath);
        message.success('文件下载成功');
      }
    } catch (error) {
      message.error(`文件下载失败: ${error}`);
    }
  };

  const handleDelete = async (file: FileInfo) => {
    if (!connection) return;

    try {
      await ApiService.deleteFile(connection.id, file.path);
      message.success('删除成功');
      loadFiles(currentPath);
    } catch (error) {
      message.error(`删除失败: ${error}`);
    }
  };

  const handleCreateDirectory = async () => {
    if (!connection || !newDirName.trim()) return;

    try {
      const dirPath = currentPath.endsWith('/') 
        ? currentPath + newDirName.trim()
        : currentPath + '/' + newDirName.trim();

      await ApiService.createDirectory(connection.id, dirPath);
      message.success('目录创建成功');
      setCreateDirModalOpen(false);
      setNewDirName('');
      loadFiles(currentPath);
    } catch (error) {
      message.error(`创建目录失败: ${error}`);
    }
  };

  const navigateUp = () => {
    if (currentPath === '/') return;
    
    const pathParts = currentPath.split('/').filter(part => part);
    pathParts.pop();
    const newPath = pathParts.length === 0 ? '/' : '/' + pathParts.join('/') + '/';
    loadFiles(newPath);
  };

  const formatFileSize = (size?: number) => {
    if (!size) return '-';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let fileSize = size;
    
    while (fileSize >= 1024 && unitIndex < units.length - 1) {
      fileSize /= 1024;
      unitIndex++;
    }
    
    return `${fileSize.toFixed(1)} ${units[unitIndex]}`;
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: FileInfo) => (
        <Space>
          {record.is_dir ? <FolderOutlined /> : <FileOutlined />}
          <span 
            style={{ cursor: 'pointer' }}
            onDoubleClick={() => handleFileDoubleClick(record)}
          >
            {text}
          </span>
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (size: number | undefined, record: FileInfo) => 
        record.is_dir ? '-' : formatFileSize(size),
    },
    {
      title: '修改时间',
      dataIndex: 'modified',
      key: 'modified',
      render: (modified: string | undefined) => 
        modified ? new Date(modified).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record: FileInfo) => (
        <Space>
          {!record.is_dir && (
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
            >
              下载
            </Button>
          )}
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              size="small"
              icon={<DeleteOutlined />}
              danger
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!connection) {
    return (
      <Content style={{ padding: '24px', textAlign: 'center' }}>
        <Title level={3}>请选择一个连接</Title>
        <p>从左侧选择或添加一个连接来开始管理文件</p>
      </Content>
    );
  }

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button icon={<HomeOutlined />} onClick={() => loadFiles('/')}>
              根目录
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => loadFiles(currentPath)}>
              刷新
            </Button>
            {currentPath !== '/' && (
              <Button onClick={navigateUp}>
                上级目录
              </Button>
            )}
          </Space>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateDirModalOpen(true)}
            >
              新建目录
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={handleUpload}
            >
              上传文件
            </Button>
          </Space>
        </Space>
      </div>

      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item onClick={() => loadFiles('/')} style={{ cursor: 'pointer' }}>
          根目录
        </Breadcrumb.Item>
        {currentPath !== '/' && 
          currentPath.split('/').filter(part => part).map((part, index, array) => {
            const path = '/' + array.slice(0, index + 1).join('/') + '/';
            return (
              <Breadcrumb.Item 
                key={path}
                onClick={() => loadFiles(path)}
                style={{ cursor: 'pointer' }}
              >
                {part}
              </Breadcrumb.Item>
            );
          })
        }
      </Breadcrumb>

      <Table
        columns={columns}
        dataSource={files}
        rowKey="path"
        loading={loading}
        pagination={false}
        size="small"
      />

      <Modal
        title="创建新目录"
        open={createDirModalOpen}
        onOk={handleCreateDirectory}
        onCancel={() => {
          setCreateDirModalOpen(false);
          setNewDirName('');
        }}
      >
        <Input
          placeholder="请输入目录名称"
          value={newDirName}
          onChange={(e) => setNewDirName(e.target.value)}
          onPressEnter={handleCreateDirectory}
        />
      </Modal>
    </Content>
  );
};

export default FileManager;
