import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Layout,
  Table,
  Button,
  Breadcrumb,
  message,
  Modal,
  Input,
  Typography,
  Space,
  Popconfirm,
  Pagination,
  Select,
  Spin,
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
  SearchOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { open, save } from '@tauri-apps/api/dialog';
import { Connection, FileInfo, PaginatedFileList } from '../types';
import { ApiService } from '../services/api';

const { Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

interface FileManagerProps {
  connection: Connection | null;
}

const FileManager: React.FC<FileManagerProps> = ({ connection }) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [loading, setLoading] = useState(false);
  const [createDirModalOpen, setCreateDirModalOpen] = useState(false);
  const [newDirName, setNewDirName] = useState('');
  
  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalFiles, setTotalFiles] = useState(0);
  const [loadingMode, setLoadingMode] = useState<'pagination' | 'all'>('pagination');
  
  // 搜索相关状态
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState<FileInfo[]>([]);
  const [searchPage, setSearchPage] = useState(0);
  const [searchTotal, setSearchTotal] = useState(0);
  
  // 计算表格高度的hook
  const [tableHeight, setTableHeight] = useState(400);

  useEffect(() => {
    if (connection) {
      // 重置状态并加载文件
      setCurrentPage(0);
      setFiles([]);
      loadFiles('/');
    }
  }, [connection]);

  // 智能选择加载模式
  const chooseLoadingMode = useCallback(async (path: string) => {
    if (!connection) return 'pagination';
    
    try {
      const count = await ApiService.getDirectoryCount(connection.id, path);
      
      // 如果文件数量超过100个，使用分页模式
      if (count > 100) {
        setLoadingMode('pagination');
        return 'pagination';
      } else {
        setLoadingMode('all');
        return 'all';
      }
    } catch (error) {
      console.warn('无法获取目录大小，默认使用分页模式:', error);
      setLoadingMode('pagination');
      return 'pagination';
    }
  }, [connection]);

  const loadFiles = useCallback(async (path: string, page: number = 0) => {
    if (!connection) return;
    
    setLoading(true);
    
    try {
      const mode = await chooseLoadingMode(path);
      
      if (mode === 'pagination') {
        // 分页模式
        const result: PaginatedFileList = await ApiService.listFilesPaginated(
          connection.id, 
          path, 
          page, 
          pageSize
        );
        
        setFiles(result.files);
        setTotalFiles(result.total);
        setCurrentPage(result.page);
      } else {
        // 全量加载模式（适用于小目录）
        const fileList = await ApiService.listFiles(connection.id, path);
        setFiles(fileList);
        setTotalFiles(fileList.length);
        setCurrentPage(0);
      }
      
      setCurrentPath(path);
      
    } catch (error) {
      message.error(`加载文件列表失败: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [connection, pageSize, chooseLoadingMode]);

  const handleFileDoubleClick = useCallback((file: FileInfo) => {
    if (file.is_dir) {
      const newPath = file.path.endsWith('/') ? file.path : file.path + '/';
      setCurrentPage(0); // 重置到第一页
      loadFiles(newPath);
    }
  }, [loadFiles]);

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
        loadFiles(currentPath, currentPage);
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
      loadFiles(currentPath, currentPage);
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
      loadFiles(currentPath, currentPage);
    } catch (error) {
      message.error(`创建目录失败: ${error}`);
    }
  };

  const navigateUp = useCallback(() => {
    if (currentPath === '/') return;
    
    const pathParts = currentPath.split('/').filter(part => part);
    pathParts.pop();
    const newPath = pathParts.length === 0 ? '/' : '/' + pathParts.join('/') + '/';
    setCurrentPage(0);
    loadFiles(newPath);
  }, [currentPath, loadFiles]);

  const formatFileSize = useCallback((size?: number) => {
    if (!size) return '-';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let fileSize = size;
    
    while (fileSize >= 1024 && unitIndex < units.length - 1) {
      fileSize /= 1024;
      unitIndex++;
    }
    
    return `${fileSize.toFixed(1)} ${units[unitIndex]}`;
  }, []);

  const columns = useMemo(() => [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: '40%',
      minWidth: 200,
      ellipsis: {
        showTitle: false,
      },
      render: (text: string, record: FileInfo) => (
        <Space>
          {record.is_dir ? (
            <FolderOutlined style={{ color: '#1890ff' }} />
          ) : (
            <FileOutlined style={{ color: '#666' }} />
          )}
          <span 
            style={{ cursor: 'pointer' }}
            onDoubleClick={() => handleFileDoubleClick(record)}
            title={text} // 鼠标悬停显示完整文件名
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
      width: 120,
      align: 'right' as const,
      render: (size: number | undefined, record: FileInfo) => 
        record.is_dir ? '-' : formatFileSize(size),
    },
    {
      title: '修改时间',
      dataIndex: 'modified',
      key: 'modified',
      width: 180,
      render: (modified: string | undefined) => 
        modified ? new Date(modified).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }) : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      align: 'right' as const,
      render: (_: any, record: FileInfo) => (
        <Space size="small">
          {!record.is_dir && (
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
              style={{ fontSize: '12px' }}
            >
              下载
            </Button>
          )}
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => handleDelete(record)}
            placement="topRight"
          >
            <Button
              size="small"
              icon={<DeleteOutlined />}
              danger
              style={{ fontSize: '12px' }}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], [handleFileDoubleClick, formatFileSize, handleDownload, handleDelete]);

  // 搜索功能
  const handleSearch = useCallback(async () => {
    if (!connection || !searchQuery.trim()) return;

    setLoading(true);
    setIsSearchMode(true);
    
    try {
      const result: PaginatedFileList = await ApiService.searchFiles(
        connection.id, 
        currentPath,
        searchQuery.trim(), 
        0, 
        pageSize
      );
      
      setSearchResults(result.files);
      setSearchTotal(result.total);
      setSearchPage(result.page);
    } catch (error) {
      message.error(`搜索文件失败: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [connection, currentPath, searchQuery, pageSize]);

  const handleSearchPageChange = useCallback((page: number, size?: number) => {
    if (size && size !== pageSize) {
      setPageSize(size);
    }
    // 搜索时，page从1开始，API从0开始
    loadFiles(currentPath, isSearchMode ? page - 1 : currentPage);
  }, [currentPath, pageSize, loadFiles, isSearchMode, currentPage]);

  const handleSearchSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSearch();
  }, [handleSearch]);

  const handleSearchReset = useCallback(() => {
    setIsSearchMode(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchPage(0);
    setSearchTotal(0);
    loadFiles(currentPath, 0);
  }, [currentPath, loadFiles]);

  useEffect(() => {
    const updateTableHeight = () => {
      // 计算可用高度：窗口高度 - 头部导航 - 工具栏 - 搜索框 - 分页栏 - 边距
      const windowHeight = window.innerHeight;
      const reservedHeight = 280; // 为其他元素预留的高度
      const availableHeight = windowHeight - reservedHeight;
      setTableHeight(Math.max(300, availableHeight));
    };

    updateTableHeight();
    window.addEventListener('resize', updateTableHeight);
    
    return () => {
      window.removeEventListener('resize', updateTableHeight);
    };
  }, []);

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
      {/* 性能信息提示 */}
      {/* {directorySize > 100 && (
        <Alert
          message={`文件数过多，已启用分页模式以提升性能`}
          description={`此目录包含 ${directorySize} 个文件，已启用分页模式以提升性能。加载时间: ${loadTime}ms`}
          type="info"
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: '16px' }}
          showIcon
        />
      )} */}

      <div style={{ marginBottom: '16px' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button icon={<HomeOutlined />} onClick={() => {
              setCurrentPage(0);
              loadFiles('/');
            }}>
              根目录
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => loadFiles(currentPath, currentPage)}
              loading={loading}
            >
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
        <Breadcrumb.Item onClick={() => {
          setCurrentPage(0);
          loadFiles('/');
        }}>
          <span style={{ cursor: 'pointer' }}>
          </span>
        </Breadcrumb.Item>
        {currentPath !== '/' && 
          currentPath.split('/').filter(part => part).map((part, index, array) => {
            const path = '/' + array.slice(0, index + 1).join('/') + '/';
            return (
              <Breadcrumb.Item 
                key={path}
                onClick={() => {
                  setCurrentPage(0);
                  loadFiles(path);
                }}
              >
                <span style={{ cursor: 'pointer' }}>{part}</span>
              </Breadcrumb.Item>
            );
          })
        }
      </Breadcrumb>

      {/* 搜索框 */}
      <div style={{ marginBottom: '16px' }}>
        <form onSubmit={handleSearchSubmit}>
          <Space style={{ width: '100%' }}>
            <Input
              placeholder="搜索文件或目录"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1 }}
              suffix={
                isSearchMode ? (
                  <Button 
                    icon={<CloseOutlined />} 
                    onClick={handleSearchReset} 
                    size="small"
                    style={{ border: 'none', color: '#999' }}
                  />
                ) : undefined
              }
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearch}
              loading={loading}
            >
              搜索
            </Button>
          </Space>
        </form>
      </div>

      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={isSearchMode ? searchResults : files}
          rowKey="path"
          pagination={false}
          size="small"
          scroll={{ y: tableHeight }}
        />
      </Spin>

      {/* 优化后的分页控件 */}
      {loadingMode === 'pagination' && totalFiles > 0 && (
        <div style={{ 
          marginTop: '16px', 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          {/* 左侧：每页显示数量选择 */}
          <Space size="small">
            <span>每页显示</span>
            <Select
              value={pageSize}
              onChange={(value) => {
                setPageSize(value);
                setCurrentPage(0);
                loadFiles(currentPath, 0);
              }}
              style={{ width: 70 }}
              size="small"
            >
              <Option value={25}>25</Option>
              <Option value={50}>50</Option>
              <Option value={100}>100</Option>
              <Option value={200}>200</Option>
            </Select>
            <span>条</span>
          </Space>

          {/* 右侧：分页控件 */}
          <Pagination
            current={isSearchMode ? searchPage + 1 : currentPage + 1}
            pageSize={pageSize}
            total={isSearchMode ? searchTotal : totalFiles}
            onChange={handleSearchPageChange}
            showSizeChanger={false}
            showQuickJumper
            showTotal={(total, range) => 
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
            }
            size="small"
          />
        </div>
      )}

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
