import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import {
  Layout,
  Button,
  Breadcrumb,
  message,
  Modal,
  Input,
  Typography,
  Space,
  Popconfirm,
  Select,
  Alert,
  Spin,
  Switch,
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
  InfoCircleOutlined,
  ThunderboltOutlined,
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

interface VirtualizedRowProps {
  index: number;
  style: any;
  data: {
    files: FileInfo[];
    onFileDoubleClick: (file: FileInfo) => void;
    onDownload: (file: FileInfo) => void;
    onDelete: (file: FileInfo) => void;
    formatFileSize: (size?: number) => string;
  };
}

const VirtualizedRow: React.FC<VirtualizedRowProps> = ({ index, style, data }) => {
  const { files, onFileDoubleClick, onDownload, onDelete, formatFileSize } = data;
  const file = files[index];

  if (!file) {
    return (
      <div style={style} className="file-row loading">
        <Spin size="small" />
        <span style={{ marginLeft: 8 }}>加载中...</span>
      </div>
    );
  }

  return (
    <div 
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: '1px solid #f0f0f0',
        backgroundColor: index % 2 === 0 ? '#fafafa' : '#ffffff',
        minWidth: '800px', // 确保最小宽度
      }}
      className="file-row"
    >
      {/* 名称列 - 使用flex布局并限制最大宽度 */}
      <div style={{ 
        flex: '1 1 0', 
        minWidth: '200px',
        maxWidth: '400px',
        display: 'flex', 
        alignItems: 'center',
        marginRight: '16px'
      }}>
        {file.is_dir ? (
          <FolderOutlined style={{ color: '#1890ff', marginRight: 8, flexShrink: 0 }} />
        ) : (
          <FileOutlined style={{ color: '#666', marginRight: 8, flexShrink: 0 }} />
        )}
        <span 
          style={{ 
            cursor: 'pointer',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            flexGrow: 1,
            minWidth: 0, // 允许文本截断
          }}
          onDoubleClick={() => onFileDoubleClick(file)}
          title={file.name} // 鼠标悬停显示完整文件名
        >
          {file.name}
        </span>
      </div>
      
      {/* 大小列 - 固定宽度并右对齐 */}
      <div style={{ 
        flex: '0 0 120px',
        textAlign: 'right',
        marginRight: '16px',
        color: '#666',
        fontSize: '14px'
      }}>
        {file.is_dir ? '-' : formatFileSize(file.size)}
      </div>
      
      {/* 修改时间列 - 固定宽度 */}
      <div style={{ 
        flex: '0 0 160px',
        marginRight: '16px',
        color: '#666',
        fontSize: '14px'
      }}>
        {file.modified ? new Date(file.modified).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }) : '-'}
      </div>
      
      {/* 操作列 - 固定宽度并右对齐 */}
      <div style={{ 
        flex: '0 0 180px', 
        textAlign: 'right'
      }}>
        <Space size="small">
          {!file.is_dir && (
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => onDownload(file)}
              style={{ fontSize: '12px' }}
            >
              下载
            </Button>
          )}
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => onDelete(file)}
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
      </div>
    </div>
  );
};

const AdvancedFileManager: React.FC<FileManagerProps> = ({ connection }) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [loading, setLoading] = useState(false);
  const [createDirModalOpen, setCreateDirModalOpen] = useState(false);
  const [newDirName, setNewDirName] = useState('');
  
  // 高级分页状态
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [totalFiles, setTotalFiles] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  
  // 虚拟滚动设置
  const [useVirtualScrolling, setUseVirtualScrolling] = useState(false);
  const [loadingMode, setLoadingMode] = useState<'pagination' | 'infinite' | 'all'>('pagination');
  
  // 搜索相关状态
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState<FileInfo[]>([]);
  const [searchPage, setSearchPage] = useState(0);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  
  // 性能监控
  const [loadTime, setLoadTime] = useState<number>(0);
  const [directorySize, setDirectorySize] = useState<number>(0);

  useEffect(() => {
    if (connection) {
      resetState();
      loadFiles('/');
    }
  }, [connection]);

  const resetState = useCallback(() => {
    setCurrentPage(0);
    setFiles([]);
    setLoadedPages(new Set());
    setTotalFiles(0);
    setHasNextPage(false);
  }, []);

  // 智能选择加载模式
  const chooseLoadingMode = useCallback(async (path: string) => {
    if (!connection) return 'pagination';
    
    try {
      const count = await ApiService.getDirectoryCount(connection.id, path);
      setDirectorySize(count);
      
      if (count > 1000) {
        setLoadingMode('infinite');
        setUseVirtualScrolling(true);
        return 'infinite';
      } else if (count > 200) {
        setLoadingMode('pagination');
        setUseVirtualScrolling(true);
        return 'pagination';
      } else {
        setLoadingMode('all');
        setUseVirtualScrolling(false);
        return 'all';
      }
    } catch (error) {
      console.warn('无法获取目录大小，默认使用分页模式:', error);
      setLoadingMode('pagination');
      setUseVirtualScrolling(false);
      return 'pagination';
    }
  }, [connection]);

  const loadFiles = useCallback(async (path: string, page: number = 0, append: boolean = false) => {
    if (!connection) return;
    
    setLoading(true);
    const startTime = Date.now();
    
    try {
      const mode = await chooseLoadingMode(path);
      
      if (mode === 'all') {
        // 小目录全量加载
        const fileList = await ApiService.listFiles(connection.id, path);
        setFiles(fileList);
        setTotalFiles(fileList.length);
        setCurrentPage(0);
        setHasNextPage(false);
      } else {
        // 分页或无限滚动模式
        const result: PaginatedFileList = await ApiService.listFilesPaginated(
          connection.id, 
          path, 
          page, 
          pageSize
        );
        
        if (append) {
          setFiles(prev => [...prev, ...result.files]);
        } else {
          setFiles(result.files);
        }
        
        setTotalFiles(result.total);
        setCurrentPage(result.page);
        setHasNextPage(result.has_more);
        setLoadedPages(prev => new Set([...prev, page]));
      }
      
      setCurrentPath(path);
      setLoadTime(Date.now() - startTime);
      
    } catch (error) {
      message.error(`加载文件列表失败: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [connection, pageSize, chooseLoadingMode]);

  // 无限滚动加载更多
  const loadMoreFiles = useCallback(async () => {
    if (!hasNextPage || loading) return;
    
    const nextPage = currentPage + 1;
    if (!loadedPages.has(nextPage)) {
      await loadFiles(currentPath, nextPage, true);
    }
  }, [hasNextPage, loading, currentPage, loadedPages, loadFiles, currentPath]);

  // 检查项目是否已加载
  const isItemLoaded = useCallback((index: number) => {
    return index < files.length;
  }, [files.length]);

  const handleFileDoubleClick = useCallback((file: FileInfo) => {
    if (file.is_dir) {
      const newPath = file.path.endsWith('/') ? file.path : file.path + '/';
      resetState();
      loadFiles(newPath);
    }
  }, [loadFiles, resetState]);

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
        resetState();
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
      resetState();
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
      resetState();
      loadFiles(currentPath);
    } catch (error) {
      message.error(`创建目录失败: ${error}`);
    }
  };

  const navigateUp = useCallback(() => {
    if (currentPath === '/') return;
    
    const pathParts = currentPath.split('/').filter(part => part);
    pathParts.pop();
    const newPath = pathParts.length === 0 ? '/' : '/' + pathParts.join('/') + '/';
    resetState();
    loadFiles(newPath);
  }, [currentPath, loadFiles, resetState]);

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

  // 搜索功能
  const handleSearch = useCallback(async () => {
    if (!connection || !searchQuery.trim()) return;

    setLoading(true);
    setIsSearchMode(true);
    setSearchPage(0);
    
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
      setSearchHasMore(result.has_more);
    } catch (error) {
      message.error(`搜索文件失败: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [connection, currentPath, searchQuery, pageSize]);

  const handleSearchLoadMore = useCallback(async () => {
    if (!connection || !searchHasMore || loading) return;
    
    const nextPage = searchPage + 1;
    setLoading(true);
    
    try {
      const result: PaginatedFileList = await ApiService.searchFiles(
        connection.id, 
        currentPath,
        searchQuery.trim(), 
        nextPage, 
        pageSize
      );
      
      setSearchResults(prev => [...prev, ...result.files]);
      setSearchPage(result.page);
      setSearchHasMore(result.has_more);
    } catch (error) {
      message.error(`加载更多搜索结果失败: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [connection, currentPath, searchQuery, searchPage, searchHasMore, loading, pageSize]);

  const handleSearchReset = useCallback(() => {
    setIsSearchMode(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchPage(0);
    setSearchTotal(0);
    setSearchHasMore(false);
    resetState();
    loadFiles(currentPath, 0);
  }, [currentPath, loadFiles, resetState]);

  const handleSearchSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSearch();
  }, [handleSearch]);

  const virtualizedRowData = useMemo(() => ({
    files: isSearchMode ? searchResults : files,
    onFileDoubleClick: handleFileDoubleClick,
    onDownload: handleDownload,
    onDelete: handleDelete,
    formatFileSize,
  }), [isSearchMode, searchResults, files, handleFileDoubleClick, handleDownload, handleDelete, formatFileSize]);

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
      {/* 性能信息和设置 */}
      {directorySize > 200 && (
        <Alert
          message={
            <Space>
              <ThunderboltOutlined />
              <span>超大目录优化</span>
            </Space>
          }
          description={
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                此目录包含 {directorySize} 个文件，已启用 {loadingMode === 'infinite' ? '无限滚动' : '分页'} 模式。
                加载时间: {loadTime}ms
              </div>
              <Space>
                <span>虚拟滚动:</span>
                <Switch
                  checked={useVirtualScrolling}
                  onChange={setUseVirtualScrolling}
                  checkedChildren="开启"
                  unCheckedChildren="关闭"
                />
                <span>每页显示:</span>
                <Select
                  value={pageSize}
                  onChange={(value) => {
                    setPageSize(value);
                    resetState();
                    loadFiles(currentPath);
                  }}
                  style={{ width: 80 }}
                >
                  <Option value={50}>50</Option>
                  <Option value={100}>100</Option>
                  <Option value={200}>200</Option>
                  <Option value={500}>500</Option>
                </Select>
              </Space>
            </Space>
          }
          type="info"
          style={{ marginBottom: '16px' }}
          showIcon
        />
      )}

      <div style={{ marginBottom: '16px' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button icon={<HomeOutlined />} onClick={() => {
              resetState();
              loadFiles('/');
            }}>
              根目录
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => {
                resetState();
                loadFiles(currentPath);
              }}
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
          resetState();
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
                  resetState();
                  loadFiles(path);
                }}
              >
                <span style={{ cursor: 'pointer' }}>
                  {part}
                </span>
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
              placeholder="搜索当前目录下的文件或目录"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: '300px' }}
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
        
        {isSearchMode && (
          <div style={{ marginTop: '8px' }}>
            <Space>
              <span style={{ color: '#666' }}>
                搜索 "{searchQuery}" 在 {currentPath} 中找到 {searchTotal} 个结果
              </span>
              {searchHasMore && (
                <Button 
                  size="small" 
                  onClick={handleSearchLoadMore}
                  loading={loading}
                >
                  加载更多搜索结果
                </Button>
              )}
            </Space>
          </div>
        )}
      </div>

      {/* 文件列表表头 */}
      <div style={{ 
        display: 'flex', 
        padding: '8px 16px', 
        backgroundColor: '#fafafa',
        borderBottom: '2px solid #d9d9d9',
        fontWeight: 'bold',
        minWidth: '800px', // 确保最小宽度
      }}>
        <div style={{ 
          flex: '1 1 0', 
          minWidth: '200px',
          maxWidth: '400px',
          marginRight: '16px'
        }}>
          名称
        </div>
        <div style={{ 
          flex: '0 0 120px',
          textAlign: 'right',
          marginRight: '16px'
        }}>
          大小
        </div>
        <div style={{ 
          flex: '0 0 160px',
          marginRight: '16px'
        }}>
          修改时间
        </div>
        <div style={{ 
          flex: '0 0 180px', 
          textAlign: 'right'
        }}>
          操作
        </div>
      </div>

      <Spin spinning={loading && files.length === 0}>
        {useVirtualScrolling && loadingMode === 'infinite' ? (
          // 无限滚动虚拟列表
          <InfiniteLoader
            isItemLoaded={isItemLoaded}
            itemCount={hasNextPage ? files.length + 1 : files.length}
            loadMoreItems={loadMoreFiles}
          >
            {({ onItemsRendered, ref }) => (
              <List
                ref={ref}
                height={500}
                width={800} // Add the required width property
                itemCount={hasNextPage ? files.length + 1 : files.length}
                itemSize={48}
                itemData={virtualizedRowData}
                onItemsRendered={onItemsRendered}
              >
                {VirtualizedRow}
              </List>
            )}
          </InfiniteLoader>
        ) : useVirtualScrolling ? (
          // 普通虚拟列表
          <List
            height={500}
            width={800} // Add the required width property
            itemCount={files.length}
            itemSize={48}
            itemData={virtualizedRowData}
          >
            {VirtualizedRow}
          </List>
        ) : (
          // 传统列表显示
          <div style={{ maxHeight: '500px', overflowY: 'auto', border: '1px solid #d9d9d9' }}>
            {files.map((file, index) => (
              <VirtualizedRow
                key={file.path}
                index={index}
                style={{}}
                data={virtualizedRowData}
              />
            ))}
          </div>
        )}
      </Spin>

      {/* 加载更多按钮（分页模式） */}
      {loadingMode === 'pagination' && hasNextPage && (
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Button 
            onClick={() => loadFiles(currentPath, currentPage + 1, true)}
            loading={loading}
          >
            加载更多 ({files.length}/{totalFiles})
          </Button>
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

export default AdvancedFileManager;