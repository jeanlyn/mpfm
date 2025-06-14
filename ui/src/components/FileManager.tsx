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
  EyeOutlined,
} from '@ant-design/icons';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Connection, FileInfo, PaginatedFileList } from '../types';
import { useAppI18n } from '../i18n/hooks/useI18n';
import { ApiService } from '../services/api';
import FilePreview from './FilePreview';
import { isPreviewable } from './FilePreview/utils/fileTypeDetector';

const { Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

interface FileManagerProps {
  connection: Connection | null;
}

const FileManager: React.FC<FileManagerProps> = ({ connection }) => {
  const { fileManager } = useAppI18n();
  
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
  
  // 预览相关状态
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null);
  
  // 动态计算表格高度
  const [tableHeight, setTableHeight] = useState(400);

  useEffect(() => {
    if (connection) {
      // 重置状态并加载文件
      setCurrentPage(0);
      setFiles([]);
      loadFiles('/');
    }
  }, [connection]);

  // 动态计算表格高度
  useEffect(() => {
    const calculateTableHeight = () => {
      // 在Tab环境中，更保守的高度计算
      const windowHeight = window.innerHeight;
      
      // 在Tab环境中预留空间（搜索框已整合到工具栏中）：
      // Tab栏(48px) + 内容padding(48px) + 工具栏(48px) + 面包屑(32px) + 分页(80px) + 表格与分页间距(16px) + 其他边距(20px)
      const reservedHeight = 252;
      
      // 计算可用高度，最小200px（确保至少能显示几行数据），最大650px
      const availableHeight = Math.min(650, Math.max(200, windowHeight - reservedHeight));
      
      setTableHeight(availableHeight);
    };

    // 初始计算
    calculateTableHeight();
    
    // 监听窗口大小变化
    window.addEventListener('resize', calculateTableHeight);
    
    // 清理事件监听器
    return () => {
      window.removeEventListener('resize', calculateTableHeight);
    };
  }, []);

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
      console.warn(fileManager.messages.directoryCountWarning, error);
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
      message.error(`${fileManager.messages.loadFilesFailed}: ${error}`);
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
        title: fileManager.dialogs.selectFileToUpload,
      });

      if (selected && typeof selected === 'string') {
        const fileName = selected.split('/').pop() || 'uploaded_file';
        const remotePath = currentPath.endsWith('/') 
          ? currentPath + fileName 
          : currentPath + '/' + fileName;

        await ApiService.uploadFile(connection.id, selected, remotePath);
        message.success(fileManager.messages.uploadSuccess);
        loadFiles(currentPath, currentPage);
      }
    } catch (error) {
      message.error(`${fileManager.messages.uploadFailed}: ${error}`);
    }
  };

  const handleDownload = async (file: FileInfo) => {
    if (!connection || file.is_dir) return;

    try {
      const savePath = await save({
        defaultPath: file.name,
        title: fileManager.dialogs.selectSaveLocation,
      });

      if (savePath) {
        await ApiService.downloadFile(connection.id, file.path, savePath);
        message.success(fileManager.messages.downloadSuccess);
      }
    } catch (error) {
      message.error(`${fileManager.messages.downloadFailed}: ${error}`);
    }
  };

  const handleDelete = async (file: FileInfo) => {
    if (!connection) return;

    try {
      await ApiService.deleteFile(connection.id, file.path);
      message.success(fileManager.messages.deleteSuccess);
      loadFiles(currentPath, currentPage);
    } catch (error) {
      message.error(`${fileManager.messages.deleteFailed}: ${error}`);
    }
  };

  const handleCreateDirectory = async () => {
    if (!connection || !newDirName.trim()) return;

    try {
      const dirPath = currentPath.endsWith('/') 
        ? currentPath + newDirName.trim()
        : currentPath + '/' + newDirName.trim();

      await ApiService.createDirectory(connection.id, dirPath);
      message.success(fileManager.messages.createDirectorySuccess);
      setCreateDirModalOpen(false);
      setNewDirName('');
      loadFiles(currentPath, currentPage);
    } catch (error) {
      message.error(`${fileManager.messages.createDirectoryFailed}: ${error}`);
    }
  };

  // 预览功能处理函数
  const handlePreview = useCallback((file: FileInfo) => {
    setPreviewFile(file);
    setPreviewVisible(true);
  }, []);

  const handlePreviewClose = useCallback(() => {
    setPreviewVisible(false);
    setPreviewFile(null);
  }, []);

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
      title: fileManager.name,
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
      title: fileManager.size,
      dataIndex: 'size',
      key: 'size',
      width: 120,
      align: 'right' as const,
      render: (size: number | undefined, record: FileInfo) => 
        record.is_dir ? '-' : formatFileSize(size),
    },
    {
      title: fileManager.modified,
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
      title: fileManager.actions.properties,
      key: 'actions',
      width: 240,
      align: 'right' as const,
      render: (_: any, record: FileInfo) => (
        <Space size="small">
          {!record.is_dir && isPreviewable(record.name) && (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record)}
              style={{ fontSize: '12px' }}
            >
              {fileManager.table.previewButton}
            </Button>
          )}
          {!record.is_dir && (
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
              style={{ fontSize: '12px' }}
            >
              {fileManager.table.downloadButton}
            </Button>
          )}
          <Popconfirm
            title={fileManager.table.confirmDelete}
            onConfirm={() => handleDelete(record)}
            placement="topRight"
          >
            <Button
              size="small"
              icon={<DeleteOutlined />}
              danger
              style={{ fontSize: '12px' }}
            >
              {fileManager.table.deleteButton}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], [handleFileDoubleClick, formatFileSize, handleDownload, handleDelete, handlePreview, fileManager]);

  // 搜索功能
  const handleSearch = useCallback(async (page: number = 0) => {
    if (!connection || !searchQuery.trim()) return;

    setLoading(true);
    setIsSearchMode(true);
    
    try {
      const result: PaginatedFileList = await ApiService.searchFiles(
        connection.id, 
        currentPath,
        searchQuery.trim(), 
        page, 
        pageSize
      );
      
      setSearchResults(result.files);
      setSearchTotal(result.total);
      setSearchPage(result.page);
    } catch (error) {
      message.error(`${fileManager.messages.searchFailed}: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [connection, currentPath, searchQuery, pageSize]);

  // 处理普通文件列表分页
  const handlePageChange = useCallback((page: number, size?: number) => {
    if (size && size !== pageSize) {
      setPageSize(size);
      setCurrentPage(0);
      // 使用新的pageSize立即加载文件，而不是依赖状态更新
      loadFilesWithNewPageSize(currentPath, 0, size);
      return;
    }
    
    const targetPage = page - 1; // Pagination组件从1开始，API从0开始
    setCurrentPage(targetPage);
    loadFiles(currentPath, targetPage);
  }, [currentPath, pageSize, loadFiles]);

  // 使用新的pageSize加载文件的辅助函数
  const loadFilesWithNewPageSize = useCallback(async (path: string, page: number = 0, newPageSize: number) => {
    if (!connection) return;
    
    setLoading(true);
    
    try {
      const mode = await chooseLoadingMode(path);
      
      if (mode === 'pagination') {
        // 分页模式，使用新的pageSize
        const result: PaginatedFileList = await ApiService.listFilesPaginated(
          connection.id, 
          path, 
          page, 
          newPageSize
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
      message.error(`${fileManager.messages.loadFilesFailed}: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [connection, chooseLoadingMode]);

  // 处理搜索结果分页
  const handleSearchPageChange = useCallback((page: number, size?: number) => {
    if (size && size !== pageSize) {
      setPageSize(size);
      // 使用新的pageSize搜索
      handleSearchWithNewPageSize(0, size);
      return;
    }
    
    const targetPage = page - 1; // Pagination组件从1开始，API从0开始
    handleSearch(targetPage);
  }, [pageSize, handleSearch]);

  // 使用新的pageSize搜索的辅助函数
  const handleSearchWithNewPageSize = useCallback(async (page: number = 0, newPageSize: number) => {
    if (!connection || !searchQuery.trim()) return;

    setLoading(true);
    setIsSearchMode(true);
    
    try {
      const result: PaginatedFileList = await ApiService.searchFiles(
        connection.id, 
        currentPath,
        searchQuery.trim(), 
        page, 
        newPageSize
      );
      
      setSearchResults(result.files);
      setSearchTotal(result.total);
      setSearchPage(result.page);
    } catch (error) {
      message.error(`${fileManager.messages.searchFailed}: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [connection, currentPath, searchQuery]);

  const handleSearchSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSearch(0);
  }, [handleSearch]);

  const handleSearchReset = useCallback(() => {
    setIsSearchMode(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchPage(0);
    setSearchTotal(0);
    loadFiles(currentPath, 0);
  }, [currentPath, loadFiles]);

  if (!connection) {
    return (
      <Content style={{ padding: '24px', textAlign: 'center' }}>
        <Title level={3}>{fileManager.welcome.selectConnection}</Title>
        <p>{fileManager.welcome.selectConnectionDescription}</p>
      </Content>
    );
  }

  return (
    <Content style={{ 
      padding: '24px', 
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto'
    }}>

      {/* 优化后的工具栏 - 整合搜索功能到一行 */}
      <div style={{ marginBottom: '16px' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {/* 左侧：导航按钮 */}
          <Space wrap>
            <Button icon={<HomeOutlined />} onClick={() => {
              setCurrentPage(0);
              loadFiles('/');
            }}>
              {fileManager.toolbar.goHome}
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => loadFiles(currentPath, currentPage)}
              loading={loading}
            >
              {fileManager.toolbar.refresh}
            </Button>
            {currentPath !== '/' && (
              <Button onClick={navigateUp}>
                {fileManager.toolbar.goUp}
              </Button>
            )}
          </Space>

          {/* 中间：搜索框 */}
          <div style={{ flex: 1, maxWidth: '400px', margin: '0 16px' }}>
            <form onSubmit={handleSearchSubmit}>
              <Input.Group compact style={{ display: 'flex' }}>
                <Input
                  placeholder={fileManager.toolbar.search}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ flex: 1 }}
                  suffix={
                    isSearchMode ? (
                      <Button 
                        icon={<CloseOutlined />} 
                        onClick={handleSearchReset} 
                        size="small"
                        type="text"
                        style={{ border: 'none', color: '#999' }}
                      />
                    ) : undefined
                  }
                />
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={() => handleSearch()}
                  loading={loading}
                />
              </Input.Group>
            </form>
          </div>

          {/* 右侧：操作按钮 */}
          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateDirModalOpen(true)}
            >
              {fileManager.toolbar.createDirectory}
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={handleUpload}
            >
              {fileManager.toolbar.uploadFile}
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
            {fileManager.breadcrumb.root}
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

      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: 0,
        overflow: 'hidden',
        marginBottom: '5px' /* 确保与分页组件有最小间距 */
      }}>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={isSearchMode ? searchResults : files}
            rowKey="path"
            pagination={false}
            size="small"
            scroll={{ y: tableHeight }}
            style={{ marginBottom: 0 }}
          />
        </Spin>
      </div>

      {/* 优化后的分页控件 */}
      {((loadingMode === 'pagination' && totalFiles > 0) || (isSearchMode && searchTotal > 0)) && (
        <div style={{ 
          marginTop: '5px', 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          flexShrink: 0, /* 防止分页组件被压缩 */
          borderTop: '1px solid #f0f0f0',
          paddingTop: '8px',
          minHeight: '48px' /* 确保分页组件有最小高度 */
        }}>
          {/* 调试信息
          <span style={{ fontSize: '12px', color: '#999' }}>
            模式: {loadingMode}, 总数: {isSearchMode ? searchTotal : totalFiles}, 搜索: {isSearchMode ? '是' : '否'}
          </span> */}
          {/* 左侧：每页显示数量选择 */}
          <Space size="small">
            <span>{fileManager.pagination.showPerPage}</span>
            <Select
              value={pageSize}
              onChange={(value) => {
                setPageSize(value);
                setCurrentPage(0);
                // 根据当前模式使用相应的加载函数
                if (isSearchMode) {
                  handleSearchWithNewPageSize(0, value);
                } else {
                  loadFilesWithNewPageSize(currentPath, 0, value);
                }
              }}
              style={{ width: 70 }}
              size="small"
            >
              <Option value={25}>25</Option>
              <Option value={50}>50</Option>
              <Option value={100}>100</Option>
              <Option value={200}>200</Option>
            </Select>
            <span>{fileManager.pagination.items}</span>
          </Space>

          {/* 右侧：分页控件 */}
          <Pagination
            current={isSearchMode ? searchPage + 1 : currentPage + 1}
            pageSize={pageSize}
            total={isSearchMode ? searchTotal : totalFiles}
            onChange={isSearchMode ? handleSearchPageChange : handlePageChange}
            showSizeChanger={false}
            showQuickJumper
            showTotal={(total, range) => 
              fileManager.pagination.pageInfo
                .replace('{start}', range[0].toString())
                .replace('{end}', range[1].toString())
                .replace('{total}', total.toString())
            }
            size="small"
          />
        </div>
      )}

      <Modal
        title={fileManager.modal.createDirectoryTitle}
        open={createDirModalOpen}
        onOk={handleCreateDirectory}
        onCancel={() => {
          setCreateDirModalOpen(false);
          setNewDirName('');
        }}
      >
        <Input
          placeholder={fileManager.modal.directoryNamePlaceholder}
          value={newDirName}
          onChange={(e) => setNewDirName(e.target.value)}
          onPressEnter={handleCreateDirectory}
        />
      </Modal>

      {/* 文件预览组件 */}
      <FilePreview
        file={previewFile}
        connection={connection}
        visible={previewVisible}
        onClose={handlePreviewClose}
        onDownload={handleDownload}
      />
    </Content>
  );
};

export default FileManager;
