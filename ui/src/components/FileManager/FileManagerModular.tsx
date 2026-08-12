import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { Layout, Table, Modal, Typography, Spin, Button, Space, Alert } from 'antd';
import { AppInput } from '../common';
import { useAppI18n } from '../../i18n/hooks/useI18n';
import FilePreview from '../FilePreview';
import UploadProgressModal from './UploadProgressModal';
import BatchUploadConflictModal from './BatchUploadConflictModal';
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
  const [saveAsPath, setSaveAsPath] = useState('');

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
    updateMultipleState
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

  const recoveredSessions = useMemo(() => {
    const visiblePaths = new Set([...state.files, ...state.searchResults].map((file) => file.path));
    return Array.from(fileOperations.editSessions.values())
      .filter((session) => !visiblePaths.has(session.remotePath));
  }, [fileOperations.editSessions, state.files, state.searchResults]);

  // 表格列定义
  const columns = useTableColumns({
    connectionId: connection?.id ?? '',
    currentPath: state.currentPath,
    files: state.files,
    searchResults: state.searchResults,
    isSearchMode: state.isSearchMode,
    fileSelection,
    isAllCurrentPageSelected,
    onDownload: fileOperations.handleDownload,
    onCopyDownloadCommand: fileOperations.handleCopyDownloadCommand,
    onCopyDownloadCurlCommand: fileOperations.handleCopyDownloadCurlCommand,
    onEdit: fileOperations.handleEdit,
    onFinishEdit: (file) => void fileOperations.finishEdit(file),
    onReopenEdit: (file, editorId) => void fileOperations.reopenEdit(file, editorId),
    onAbandonEdit: (file) => {
      Modal.confirm({
        title: fileManager.messages.editorAbandonTitle,
        content: fileManager.messages.editorAbandonDescription,
        okText: fileManager.table.abandonEditButton,
        okButtonProps: { danger: true },
        cancelText: fileManager.messages.editorKeepEditing,
        onOk: () => fileOperations.abandonEdit(file),
      });
    },
    editingPaths: fileOperations.editingPaths,
    finishingPaths: fileOperations.finishingPaths,
    detectedEditors: fileOperations.detectedEditors,
    detectingEditors: fileOperations.detectingEditors,
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
        onBatchUpload={fileOperations.handleBatchUpload}
        onUploadDirectory={fileOperations.handleUploadDirectory}
      />

      {/* 面包屑导航 */}
      <BreadcrumbNav
        currentPath={state.currentPath}
        onNavigate={handleBreadcrumbNavigate}
      />

      {recoveredSessions.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={fileManager.messages.editorRecoveredTitle}
          description={(
            <Space direction="vertical" style={{ width: '100%' }}>
              <span>{fileManager.messages.editorRecoveredDescription}</span>
              {recoveredSessions.map((session) => {
                const file = { name: session.fileName, path: session.remotePath, is_dir: false };
                return (
                  <Space key={session.sessionId} wrap>
                    <Typography.Text code>{session.remotePath}</Typography.Text>
                    <Button size="small" onClick={() => void fileOperations.reopenEdit(file)}>
                      {fileManager.table.reopenEditButton}
                    </Button>
                    <Button size="small" type="primary" onClick={() => void fileOperations.finishEdit(file)}>
                      {fileManager.table.finishEditButton}
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => Modal.confirm({
                        title: fileManager.messages.editorAbandonTitle,
                        content: fileManager.messages.editorAbandonDescription,
                        okText: fileManager.table.abandonEditButton,
                        okButtonProps: { danger: true },
                        cancelText: fileManager.messages.editorKeepEditing,
                        onOk: () => fileOperations.abandonEdit(file),
                      })}
                    >
                      {fileManager.table.abandonEditButton}
                    </Button>
                  </Space>
                );
              })}
            </Space>
          )}
          style={{ marginBottom: 12 }}
        />
      )}

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
            rowClassName={(record) => record.is_dir ? 'file-manager-directory-row' : ''}
            onRow={(record) => ({
              onDoubleClick: (event) => {
                if (!record.is_dir) return;
                const target = event.target as HTMLElement;
                if (target.closest('.file-manager-actions, .ant-checkbox-wrapper, button, input, a, [role="button"]')) {
                  return;
                }
                event.preventDefault();
                fileOperations.handleFileDoubleClick(record);
              },
            })}
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
        <AppInput
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

      <BatchUploadConflictModal
        open={fileOperations.batchUploadItems.length > 0}
        items={fileOperations.batchUploadItems}
        onCancel={fileOperations.closeBatchUploadConflict}
        onConfirm={(items) => void fileOperations.confirmBatchUpload(items)}
      />

      <Modal
        title={fileManager.messages.editorConflictTitle}
        open={Boolean(fileOperations.conflictSession)}
        onCancel={fileOperations.closeConflict}
        footer={null}
        destroyOnClose
      >
        <p>
          {fileManager.messages.editorConflictDescription}
        </p>
        {fileOperations.conflictSession?.error && (
          <Alert
            type="warning"
            showIcon
            message={fileOperations.conflictSession.error}
            style={{ marginBottom: 12 }}
          />
        )}
        <AppInput
          value={saveAsPath}
          placeholder={fileManager.messages.editorSaveAsPlaceholder}
          onChange={(event) => setSaveAsPath(event.target.value)}
        />
        <Space style={{ marginTop: 16, width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={fileOperations.closeConflict}>{fileManager.messages.editorReturn}</Button>
          <Button
            disabled={!saveAsPath.trim()}
            loading={Boolean(fileOperations.conflictSession && fileOperations.finishingPaths.has(fileOperations.conflictSession.remotePath))}
            onClick={() => {
              const session = fileOperations.conflictSession;
              if (!session) return;
              void fileOperations.finishEdit({
                name: session.fileName,
                path: session.remotePath,
                is_dir: false,
              }, 'saveAs', saveAsPath).then((completed) => {
                if (completed) setSaveAsPath('');
              });
            }}
          >
            {fileManager.messages.editorSaveAs}
          </Button>
          <Button
            danger
            type="primary"
            loading={Boolean(fileOperations.conflictSession && fileOperations.finishingPaths.has(fileOperations.conflictSession.remotePath))}
            onClick={() => {
              const session = fileOperations.conflictSession;
              if (!session) return;
              void fileOperations.finishEdit({
                name: session.fileName,
                path: session.remotePath,
                is_dir: false,
              }, 'overwrite');
            }}
          >
            {fileManager.messages.editorOverwrite}
          </Button>
        </Space>
      </Modal>
      </div>
    </Content>
  );
};

export default FileManager;
