import React, { useEffect, useCallback, useMemo } from 'react';
import { Layout, Table, Modal, Input, Typography, Spin } from 'antd';
import { useAppI18n } from '../../i18n/hooks/useI18n';
import FilePreview from '../FilePreview';

// 模块化组件导入
import {
  Toolbar,
  BreadcrumbNav,
  PaginationControls,
  useTableColumns,
  BatchOperationToolbar,
  BatchDownloadModal,
} from './components';

// Hooks 导入
import {
  useFileManagerState,
  useFileOperations,
  useSearchAndPagination,
  usePreviewAndBatch,
  useTableHeight,
  useFileSelection,
} from './hooks';

// 类型导入
import { FileManagerProps } from './types';

const { Content } = Layout;
const { Title } = Typography;

/**
 * 主文件管理器组件 - 模块化重构版本
 */
const FileManager: React.FC<FileManagerProps> = ({ connection }) => {
  const { fileManager } = useAppI18n();
  
  // 状态管理
  const { state, updateState, updateMultipleState, resetState } = useFileManagerState();
  const fileSelection = useFileSelection();

  // 表格高度计算
  const handleHeightChange = useCallback((height: number) => {
    updateState('tableHeight', height);
  }, [updateState]);
  
  useTableHeight(handleHeightChange);

  // 文件操作
  const fileOperations = useFileOperations(
    connection,
    state.currentPath,
    state.currentPage,
    state.pageSize,
    updateMultipleState
  );

  // 搜索和分页
  const searchAndPagination = useSearchAndPagination(
    connection,
    state.currentPath,
    state.pageSize,
    state.searchQuery,
    updateMultipleState,
    fileOperations.chooseLoadingMode
  );

  // 预览和批量操作
  const previewAndBatch = usePreviewAndBatch(
    connection,
    state.files,
    state.searchResults,
    state.isSearchMode,
    fileSelection,
    updateMultipleState
  );

  // 连接变化时重置状态
  useEffect(() => {
    if (connection) {
      resetState();
      fileSelection.clearSelection();
      fileOperations.loadFiles('/');
    }
  }, [connection, resetState, fileSelection.clearSelection, fileOperations.loadFiles]);

  // 计算当前页面是否全选
  const isAllCurrentPageSelected = useMemo(() => {
    const currentFiles = state.isSearchMode ? state.searchResults : state.files;
    // 现在支持选择所有文件，包括文件夹
    return currentFiles.length > 0 && currentFiles.every(file => fileSelection.selectedFiles.has(file.path));
  }, [state.files, state.searchResults, state.isSearchMode, fileSelection.selectedFiles]);

  // 表格列定义
  const columns = useTableColumns({
    files: state.files,
    searchResults: state.searchResults,
    isSearchMode: state.isSearchMode,
    fileSelection,
    isAllCurrentPageSelected,
    onFileDoubleClick: fileOperations.handleFileDoubleClick,
    onDownload: fileOperations.handleDownload,
    onDelete: fileOperations.handleDelete,
    onPreview: previewAndBatch.handlePreview,
  });

  // 工具栏事件处理
  const handleGoHome = useCallback(() => {
    updateState('currentPage', 0);
    fileOperations.loadFiles('/');
  }, [updateState, fileOperations.loadFiles]);

  const handleRefresh = useCallback(() => {
    fileOperations.loadFiles(state.currentPath, state.currentPage);
  }, [fileOperations.loadFiles, state.currentPath, state.currentPage]);

  const handleBreadcrumbNavigate = useCallback((path: string) => {
    updateState('currentPage', 0);
    fileOperations.loadFiles(path);
  }, [updateState, fileOperations.loadFiles]);

  const handleSearchSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    searchAndPagination.handleSearch(0);
  }, [searchAndPagination.handleSearch]);

  const handleCreateDirectorySubmit = useCallback(async () => {
    if (!state.newDirName.trim()) return;
    
    const success = await fileOperations.handleCreateDirectory(state.newDirName);
    if (success) {
      updateMultipleState({
        createDirModalOpen: false,
        newDirName: '',
      });
    }
  }, [state.newDirName, fileOperations.handleCreateDirectory, updateMultipleState]);

  const handlePageSizeChange = useCallback((value: number) => {
    updateMultipleState({ pageSize: value, currentPage: 0 });
    // 根据当前模式使用相应的加载函数
    if (state.isSearchMode) {
      searchAndPagination.handleSearchWithNewPageSize(0, value);
    } else {
      searchAndPagination.loadFilesWithNewPageSize(state.currentPath, 0, value);
    }
  }, [state.isSearchMode, state.currentPath, updateMultipleState, searchAndPagination.handleSearchWithNewPageSize, searchAndPagination.loadFilesWithNewPageSize]);

  // 如果没有连接，显示欢迎界面
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
      {/* 工具栏 */}
      <Toolbar
        currentPath={state.currentPath}
        loading={state.loading}
        searchQuery={state.searchQuery}
        isSearchMode={state.isSearchMode}
        onGoHome={handleGoHome}
        onRefresh={handleRefresh}
        onNavigateUp={fileOperations.navigateUp}
        onSearch={() => searchAndPagination.handleSearch()}
        onSearchReset={searchAndPagination.handleSearchReset}
        onSearchSubmit={handleSearchSubmit}
        onSearchQueryChange={(value) => updateState('searchQuery', value)}
        onCreateDirectory={() => updateState('createDirModalOpen', true)}
        onUpload={fileOperations.handleUpload}
      />

      {/* 面包屑导航 */}
      <BreadcrumbNav
        currentPath={state.currentPath}
        onNavigate={handleBreadcrumbNavigate}
      />

      {/* 批量操作工具栏 */}
      <BatchOperationToolbar
        selection={fileSelection}
        onBatchDownload={previewAndBatch.handleBatchDownload}
        onSelectAll={() => fileSelection.toggleAllSelection(state.isSearchMode ? state.searchResults : state.files)}
        onDeselectAll={fileSelection.clearSelection}
        selectedFiles={fileSelection.getSelectedFiles(state.isSearchMode ? state.searchResults : state.files)}
      />

      {/* 文件表格 */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: 0,
        overflow: 'hidden',
        marginBottom: '5px'
      }}>
        <Spin spinning={state.loading}>
          <Table
            columns={columns}
            dataSource={state.isSearchMode ? state.searchResults : state.files}
            rowKey="path"
            pagination={false}
            size="small"
            scroll={{ y: state.tableHeight }}
            style={{ marginBottom: 0 }}
          />
        </Spin>
      </div>

      {/* 分页控件 */}
      <PaginationControls
        loadingMode={state.loadingMode}
        totalFiles={state.totalFiles}
        isSearchMode={state.isSearchMode}
        searchTotal={state.searchTotal}
        currentPage={state.currentPage}
        searchPage={state.searchPage}
        pageSize={state.pageSize}
        onPageChange={searchAndPagination.handlePageChange}
        onSearchPageChange={searchAndPagination.handleSearchPageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* 创建目录模态框 */}
      <Modal
        title={fileManager.modal.createDirectoryTitle}
        open={state.createDirModalOpen}
        onOk={handleCreateDirectorySubmit}
        onCancel={() => {
          updateMultipleState({
            createDirModalOpen: false,
            newDirName: '',
          });
        }}
      >
        <Input
          placeholder={fileManager.modal.directoryNamePlaceholder}
          value={state.newDirName}
          onChange={(e) => updateState('newDirName', e.target.value)}
          onPressEnter={handleCreateDirectorySubmit}
        />
      </Modal>

      {/* 文件预览组件 */}
      <FilePreview
        file={state.previewFile}
        connection={connection}
        visible={state.previewVisible}
        onClose={previewAndBatch.handlePreviewClose}
        onDownload={fileOperations.handleDownload}
      />

      {/* 批量下载进度对话框 */}
      <BatchDownloadModal
        visible={state.batchDownloadVisible}
        progress={state.batchDownloadProgress}
        onClose={previewAndBatch.handleBatchDownloadClose}
      />
    </Content>
  );
};

export default FileManager;
