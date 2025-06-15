import { useMemo } from 'react';
import { Space, Button, Popconfirm, Checkbox } from 'antd';
import {
  FolderOutlined,
  FileOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { FileInfo } from '../../../types';
import { useAppI18n } from '../../../i18n/hooks/useI18n';
import { isPreviewable } from '../../FilePreview/utils/fileTypeDetector';
import { useFileSelection } from '../hooks/useFileSelection';
import { formatFileSize, formatModifiedTime } from '../utils';
import { COLUMN_WIDTHS, ACTION_BUTTON_WIDTH } from '../constants';

interface TableColumnsProps {
  files: FileInfo[];
  searchResults: FileInfo[];
  isSearchMode: boolean;
  fileSelection: ReturnType<typeof useFileSelection>;
  isAllCurrentPageSelected: boolean;
  onFileDoubleClick: (file: FileInfo) => void;
  onDownload: (file: FileInfo) => void;
  onDelete: (file: FileInfo) => void;
  onPreview: (file: FileInfo) => void;
}

/**
 * 表格列定义组件
 */
export const useTableColumns = ({
  files,
  searchResults,
  isSearchMode,
  fileSelection,
  isAllCurrentPageSelected,
  onFileDoubleClick,
  onDownload,
  onDelete,
  onPreview,
}: TableColumnsProps) => {
  const { fileManager } = useAppI18n();

  const columns = useMemo(() => [
    {
      title: (
        <Checkbox
          indeterminate={fileSelection.hasSelection && !isAllCurrentPageSelected}
          checked={isAllCurrentPageSelected}
          onChange={() => fileSelection.toggleAllSelection(isSearchMode ? searchResults : files)}
        />
      ),
      dataIndex: 'select',
      key: 'select',
      width: COLUMN_WIDTHS.select,
      align: 'center' as const,
      render: (_: any, record: FileInfo) => (
        <Checkbox
          checked={fileSelection.selectedFiles.has(record.path)}
          onChange={() => fileSelection.toggleFileSelection(record.path)}
        />
      ),
    },
    {
      title: fileManager.name,
      dataIndex: 'name',
      key: 'name',
      width: COLUMN_WIDTHS.name,
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
            onDoubleClick={() => onFileDoubleClick(record)}
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
      width: COLUMN_WIDTHS.size,
      align: 'right' as const,
      render: (size: number | undefined, record: FileInfo) => 
        record.is_dir ? '-' : formatFileSize(size),
    },
    {
      title: fileManager.modified,
      dataIndex: 'modified',
      key: 'modified',
      width: COLUMN_WIDTHS.modified,
      render: (modified: string | undefined) => formatModifiedTime(modified),
    },
    {
      title: fileManager.actions.properties,
      key: 'actions',
      width: COLUMN_WIDTHS.actions,
      align: 'right' as const,
      render: (_: any, record: FileInfo) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
          {/* 预览按钮位置 - 固定宽度确保对齐 */}
          <div style={{ width: ACTION_BUTTON_WIDTH }}>
            {!record.is_dir && isPreviewable(record.name) && (
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => onPreview(record)}
                style={{ 
                  fontSize: '12px', 
                  width: '100%',
                  padding: '4px 8px',
                  overflow: 'hidden'
                }}
                title={fileManager.table.previewButton}
              >
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block'
                }}>
                  {fileManager.table.previewButton}
                </span>
              </Button>
            )}
          </div>
          
          {/* 下载按钮位置 - 固定宽度确保对齐 */}
          <div style={{ width: ACTION_BUTTON_WIDTH }}>
            {!record.is_dir && (
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => onDownload(record)}
                style={{ 
                  fontSize: '12px', 
                  width: '100%',
                  padding: '4px 8px',
                  overflow: 'hidden'
                }}
                title={fileManager.table.downloadButton}
              >
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block'
                }}>
                  {fileManager.table.downloadButton}
                </span>
              </Button>
            )}
          </div>
          
          {/* 删除按钮位置 - 固定宽度确保对齐 */}
          <div style={{ width: ACTION_BUTTON_WIDTH }}>
            <Popconfirm
              title={fileManager.table.confirmDelete}
              onConfirm={() => onDelete(record)}
              placement="topRight"
            >
              <Button
                size="small"
                icon={<DeleteOutlined />}
                danger
                style={{ 
                  fontSize: '12px', 
                  width: '100%',
                  padding: '4px 8px',
                  overflow: 'hidden'
                }}
                title={fileManager.table.deleteButton}
              >
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block'
                }}>
                  {fileManager.table.deleteButton}
                </span>
              </Button>
            </Popconfirm>
          </div>
        </div>
      ),
    },
  ], [
    fileSelection.hasSelection,
    fileSelection.selectedFiles,
    isAllCurrentPageSelected,
    files,
    searchResults,
    isSearchMode,
    fileManager,
  ]);

  return columns;
};
