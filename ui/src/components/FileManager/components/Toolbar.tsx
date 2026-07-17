import React from 'react';
import { Button, Space, Dropdown, Tooltip } from 'antd';
import { AppInput } from '../../common';
import {
  HomeOutlined,
  ReloadOutlined,
  SearchOutlined,
  PlusOutlined,
  UploadOutlined,
  FolderAddOutlined,
  ArrowUpOutlined,
  DownOutlined,
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
  onUploadDirectory: () => void;
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
  onSearchQueryChange,
  onCreateDirectory,
  onUpload,
  onUploadDirectory,
}) => {
  const { fileManager } = useAppI18n();

  return (
    <div
      style={{
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'nowrap',
      }}
    >
      {/* 左侧：导航操作（图标按钮分段组，次要操作不抢视觉权重） */}
      <Space.Compact style={{ flex: '0 0 auto' }}>
        <Tooltip title={fileManager.toolbar.goHome}>
          <Button icon={<HomeOutlined />} onClick={onGoHome} />
        </Tooltip>
        <Tooltip title={fileManager.toolbar.refresh}>
          <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading} />
        </Tooltip>
        <Tooltip title={fileManager.toolbar.goUp}>
          <Button
            icon={<ArrowUpOutlined />}
            onClick={onNavigateUp}
            disabled={currentPath === '/'}
          />
        </Tooltip>
      </Space.Compact>

      {/* 中间：搜索框（自适应填满剩余空间，消除中部空隙） */}
      <AppInput.Search
        style={{ flex: '1 1 auto', minWidth: 0 }}
        placeholder={fileManager.toolbar.search}
        value={searchQuery}
        loading={loading}
        allowClear
        enterButton={<SearchOutlined />}
        onChange={(e) => {
          const value = e.target.value;
          onSearchQueryChange(value);
          if (value === '' && isSearchMode) {
            onSearchReset();
          }
        }}
        onSearch={onSearch}
      />

      {/* 右侧：操作按钮（上传为唯一主操作，新建目录为次要操作） */}
      <Space size="small" style={{ flex: '0 0 auto' }}>
        <Button icon={<PlusOutlined />} onClick={onCreateDirectory}>
          {fileManager.toolbar.createDirectory}
        </Button>
        <Dropdown.Button
          type="primary"
          icon={<DownOutlined />}
          onClick={onUpload}
          menu={{
            items: [
              {
                key: 'upload-directory',
                icon: <FolderAddOutlined />,
                label: fileManager.toolbar.uploadDirectory,
                onClick: onUploadDirectory,
              },
            ],
          }}
        >
          <UploadOutlined />
          <span style={{ marginInlineStart: 6 }}>{fileManager.toolbar.uploadFile}</span>
        </Dropdown.Button>
      </Space>
    </div>
  );
};

export default Toolbar;
