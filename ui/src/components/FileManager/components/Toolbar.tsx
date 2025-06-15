import React from 'react';
import { Button, Space, Input } from 'antd';
import {
  HomeOutlined,
  ReloadOutlined,
  SearchOutlined,
  CloseOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useAppI18n } from '../../../i18n/hooks/useI18n';

interface ToolbarProps {
  currentPath: string;
  loading: boolean;
  searchQuery: string;
  isSearchMode: boolean;
  onGoHome: () => void;
  onRefresh: () => void;
  onNavigateUp: () => void;
  onSearch: () => void;
  onSearchReset: () => void;
  onSearchSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onSearchQueryChange: (value: string) => void;
  onCreateDirectory: () => void;
  onUpload: () => void;
}

/**
 * 工具栏组件 - 整合搜索功能到一行
 */
const Toolbar: React.FC<ToolbarProps> = ({
  currentPath,
  loading,
  searchQuery,
  isSearchMode,
  onGoHome,
  onRefresh,
  onNavigateUp,
  onSearch,
  onSearchReset,
  onSearchSubmit,
  onSearchQueryChange,
  onCreateDirectory,
  onUpload,
}) => {
  const { fileManager } = useAppI18n();

  return (
    <div style={{ marginBottom: '16px' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* 左侧：导航按钮 */}
        <Space wrap>
          <Button icon={<HomeOutlined />} onClick={onGoHome}>
            {fileManager.toolbar.goHome}
          </Button>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={onRefresh}
            loading={loading}
          >
            {fileManager.toolbar.refresh}
          </Button>
          {currentPath !== '/' && (
            <Button onClick={onNavigateUp}>
              {fileManager.toolbar.goUp}
            </Button>
          )}
        </Space>

        {/* 中间：搜索框 */}
        <div style={{ flex: 1, maxWidth: '400px', margin: '0 16px' }}>
          <form onSubmit={onSearchSubmit}>
            <Input.Group compact style={{ display: 'flex' }}>
              <Input
                placeholder={fileManager.toolbar.search}
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                style={{ flex: 1 }}
                suffix={
                  isSearchMode ? (
                    <Button 
                      icon={<CloseOutlined />} 
                      onClick={onSearchReset} 
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
                onClick={onSearch}
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
            onClick={onCreateDirectory}
          >
            {fileManager.toolbar.createDirectory}
          </Button>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={onUpload}
          >
            {fileManager.toolbar.uploadFile}
          </Button>
        </Space>
      </Space>
    </div>
  );
};

export default Toolbar;
