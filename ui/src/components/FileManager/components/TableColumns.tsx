import { useMemo } from 'react';
import { Button, Popconfirm, Checkbox, Dropdown, Space } from 'antd';
import {
  DownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  CopyOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { FileInfo } from '../../../types';
import { useAppI18n } from '../../../i18n/hooks/useI18n';
import { isPreviewable } from '../../FilePreview/utils/fileTypeDetector';
import { useFileSelection } from '../hooks/useFileSelection';
import { formatFileSize, formatModifiedTime } from '../utils';
import { COLUMN_WIDTHS, ACTIONS_COLUMN_MIN_WIDTH } from '../constants';
import { FileNameCell } from './FileNameCell';

interface TableColumnsProps {
  connectionId: string;
  files: FileInfo[];
  searchResults: FileInfo[];
  isSearchMode: boolean;
  fileSelection: ReturnType<typeof useFileSelection>;
  isAllCurrentPageSelected: boolean;
  onFileDoubleClick: (file: FileInfo) => void;
  onDownload: (file: FileInfo) => void;
  onCopyDownloadCommand: (file: FileInfo, targetShell: 'bash' | 'powershell') => void;
  onCopyDownloadCurlCommand: (file: FileInfo) => void;
  onDelete: (file: FileInfo) => void;
  onPreview: (file: FileInfo) => void;
}

/**
 * 表格列定义组件
 */
export const useTableColumns = ({
  connectionId,
  files,
  searchResults,
  isSearchMode,
  fileSelection,
  isAllCurrentPageSelected,
  onFileDoubleClick,
  onDownload,
  onCopyDownloadCommand,
  onCopyDownloadCurlCommand,
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
        <FileNameCell
          connectionId={connectionId}
          text={text}
          record={record}
          onDoubleClick={onFileDoubleClick}
        />
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
      minWidth: ACTIONS_COLUMN_MIN_WIDTH,
      align: 'right' as const,
      render: (_: any, record: FileInfo) => (
        <div className="file-manager-actions">
          {!record.is_dir && isPreviewable(record.name) && (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onPreview(record)}
              title={fileManager.table.previewButton}
            >
              {fileManager.table.previewButton}
            </Button>
          )}

          {!record.is_dir && (
            <Space.Compact className="file-manager-download-compact">
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => onDownload(record)}
              >
                {fileManager.table.downloadButton}
              </Button>
              <Dropdown
                trigger={['click']}
                placement="bottomRight"
                menu={{
                  items: [
                    {
                      type: 'group',
                      label: fileManager.actions.copyCliCommand,
                      children: [
                        {
                          key: 'bash',
                          icon: <CopyOutlined />,
                          label: fileManager.actions.copyBashCommand,
                          onClick: () => onCopyDownloadCommand(record, 'bash'),
                        },
                        {
                          key: 'powershell',
                          icon: <CopyOutlined />,
                          label: fileManager.actions.copyPowerShellCommand,
                          onClick: () => onCopyDownloadCommand(record, 'powershell'),
                        },
                        {
                          key: 'curl',
                          icon: <CopyOutlined />,
                          label: fileManager.actions.copyCurlCommand,
                          onClick: () => onCopyDownloadCurlCommand(record),
                        },
                      ],
                    },
                  ],
                }}
              >
                <Button
                  size="small"
                  icon={<DownOutlined />}
                  title={fileManager.actions.copyCliCommand}
                />
              </Dropdown>
            </Space.Compact>
          )}

          <Popconfirm
            title={fileManager.table.confirmDelete}
            onConfirm={() => onDelete(record)}
            placement="topRight"
          >
            <Button
              size="small"
              icon={<DeleteOutlined />}
              danger
              title={fileManager.table.deleteButton}
            >
              {fileManager.table.deleteButton}
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ], [
    connectionId,
    fileSelection.hasSelection,
    fileSelection.selectedFiles,
    isAllCurrentPageSelected,
    files,
    searchResults,
    isSearchMode,
    fileManager,
    onFileDoubleClick,
    onDownload,
    onCopyDownloadCommand,
    onCopyDownloadCurlCommand,
    onDelete,
    onPreview,
  ]);

  return columns;
};
