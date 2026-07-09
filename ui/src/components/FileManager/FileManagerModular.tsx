import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import { Layout, Table, Modal, Input, Typography, Spin } from 'antd';
import { useAppI18n } from '../../i18n/hooks/useI18n';
import FilePreview from '../FilePreview';
import UploadProgressModal from './UploadProgressModal';
import './FileManager.css';

// 模块化组件导入
import {
  Toolbar,
  BreadcrumbNav,
  PaginationControls,
  useTableColumns,
  BatchOperationToolbar,
  BatchDownloadModal,
  DragUploadOverlay,
} from './components';

// Hooks 导入
import {
  useFileManagerState,
  useFileOperations,
  useSearchAndPagination,
  usePreviewAndBatch,
  useTableHeight,
  useFileSelection,
  useDragUpload,
} from './hooks';

// 类型导入
import { FileManagerProps } from './types';
import { useConnectionPathRegistry } from '../../contexts/ConnectionPathRegistry';

const { Content } = Layout;
const { Title } = Typography;

/**
 * 主文件管理器组件 - 模块化重构版本
 */
const FileManager: React.FC<FileManagerProps> = ({ connection }) => {
  const { fileManager } = useAppI18n();
  const {
    registerPath,
    registerRefresh,
    unregisterRefresh,
  } = useConnectionPathRegistry();
  
  // 状态管理
  const { state, updateState, updateMultipleState, resetState } = useFileManagerState();
  const fileSelection = useFileSelection();

  // 表格高度：按容器实际高度计算，填满 flex 剩余区域
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const handleHeightChange = useCallback((height: number) => {
    updateState('tableHeight', height);
  }, [updateState]);

  useTableHeight(tableContainerRef, handleHeightChange, [
    state.loading,
    state.files.length,
    state.searchResults.length,
    fileSelection.selectedFiles.size,
  ]);

  // 文件操作
  const fileOperations = useFileOperations(
    connection,
    state.currentPath,
    state.currentPage,
    state.pageSize,
    updateMultipleState
  );

  const handleDragDropUpload = useCallback((paths: string[]) => {
    void fileOperations.uploadLocalPaths(paths);
  }, [fileOperations.uploadLocalPaths]);

  const { isDraggingOver } = useDragUpload({
    connection,
    dropZoneRef,
    onDrop: handleDragDropUpload,
  });

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

  // 连接或 S3 bucket 变化时重置并重新加载
  useEffect(() => {
    if (connection) {
      resetState();
      fileSelection.clearSelection();
      fileOperations.loadFiles('/');
    }
  }, [
    connection?.id,
    connection?.config?.bucket,
    resetState,
    fileSelection.clearSelection,
    fileOperations.loadFiles,
  ]);

  useEffect(() => {
    if (!connection) return;
    registerPath(connection.id, state.currentPath);
  }, [connection, state.currentPath, registerPath]);

  useEffect(() => {
    if (!connection) return;

    const refresh = () => {
      fileOperations.loadFiles(state.currentPath, state.currentPage);
    };

    registerRefresh(connection.id, refresh);
    return () => unregisterRefresh(connection.id);
  }, [
    connection,
    state.currentPath,
    state.currentPage,
    fileOperations.loadFiles,
    registerRefresh,
    unregisterRefresh,
  ]);

  // 计算当前页面是否全选
  const isAllCurrentPageSelected = useMemo(() => {
    const currentFiles = state.isSearchMode ? state.searchResults : state.files;
    // 现在支持选择所有文件，包括文件夹
    return currentFiles.length > 0 && currentFiles.every(file => fileSelection.selectedFiles.has(file.path));
  }, [state.files, state.searchResults, state.isSearchMode, fileSelection.selectedFiles]);

  // 表格列定义
  const columns = useTableColumns({
    connectionId: connection?.id ?? '',
    files: state.files,
    searchResults: state.searchResults,
    isSearchMode: state.isSearchMode,
    fileSelection,
    isAllCurrentPageSelected,
    onFileDoubleClick: fileOperations.handleFileDoubleClick,
    onDownload: fileOperations.handleDownload,
    onCopyDownloadCommand: fileOperations.handleCopyDownloadCommand,
    onCopyDownloadCurlCommand: fileOperations.handleCopyDownloadCurlCommand,
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
      padding: 0,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div
        ref={dropZoneRef}
        className="file-manager-content"
        style={{
          padding: '24px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
      <DragUploadOverlay visible={isDraggingOver} />
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
        onUploadDirectory={fileOperations.handleUploadDirectory}
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
      <div
        ref={tableContainerRef}
        className="file-manager-table-container"
      >
        <Spin spinning={state.loading}>
          <Table
            columns={columns}
            dataSource={state.isSearchMode ? state.searchResults : state.files}
            rowKey="path"
            pagination={false}
            size="small"
            scroll={{ x: 'max-content', y: state.tableHeight }}
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

      {/* 上传进度对话框 */}
      <UploadProgressModal
        visible={state.uploadVisible}
        progress={state.uploadProgress}
        onClose={fileOperations.handleUploadClose}
      />
      </div>
    </Content>
  );
};

export default FileManager;
