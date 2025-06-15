import React from 'react';
import { Button, Space, Typography, Tooltip } from 'antd';
import { DownloadOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useAppI18n } from '../../i18n/hooks/useI18n';
import { FileSelectionState } from '../../hooks/useFileSelection';
import { formatFileSize } from '../../utils/batchDownload';

const { Text } = Typography;

interface BatchOperationToolbarProps {
  selection: FileSelectionState;
  onBatchDownload: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  selectedFiles: any[]; // 传入选中的文件以便计算大小
}

const BatchOperationToolbar: React.FC<BatchOperationToolbarProps> = ({
  selection,
  onBatchDownload,
  onSelectAll,
  onDeselectAll,
  selectedFiles,
}) => {
  const { fileManager } = useAppI18n();

  if (!selection.hasSelection) {
    return null;
  }

  // 计算选中文件的总大小
  const totalSize = selectedFiles.reduce((total, file) => {
    return total + (file.size || 0);
  }, 0);

  return (
    <div style={{
      padding: '8px 16px',
      backgroundColor: '#f0f0f0',
      borderRadius: '6px',
      marginBottom: '16px',
      border: '1px solid #d9d9d9'
    }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Text>
            {fileManager.messages.selectedFiles.replace('{count}', selection.selectedCount.toString())}
            {totalSize > 0 && (
              <span style={{ color: '#666', marginLeft: '8px' }}>
                ({formatFileSize(totalSize)})
              </span>
            )}
          </Text>
          
          <Button
            size="small"
            icon={<CheckOutlined />}
            onClick={onSelectAll}
            type="link"
          >
            {fileManager.actions.selectAll}
          </Button>
          
          <Button
            size="small"
            icon={<CloseOutlined />}
            onClick={onDeselectAll}
            type="link"
          >
            {fileManager.actions.deselectAll}
          </Button>
        </Space>

        <Space>
          <Tooltip title={selection.selectedCount === 0 ? fileManager.messages.noFilesSelected : ''}>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={onBatchDownload}
              disabled={selection.selectedCount === 0}
            >
              {fileManager.actions.batchDownload}
            </Button>
          </Tooltip>
        </Space>
      </Space>
    </div>
  );
};

export default BatchOperationToolbar;
