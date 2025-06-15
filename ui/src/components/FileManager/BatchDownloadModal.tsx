import React from 'react';
import { Modal, Progress, Typography, Space, Alert } from 'antd';
import { CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useAppI18n } from '../../i18n/hooks/useI18n';
import { BatchDownloadProgress } from '../../utils/batchDownload';

const { Text } = Typography;

interface BatchDownloadModalProps {
  visible: boolean;
  progress: BatchDownloadProgress | null;
  onClose: () => void;
}

const BatchDownloadModal: React.FC<BatchDownloadModalProps> = ({
  visible,
  progress,
  onClose,
}) => {
  const { fileManager } = useAppI18n();

  if (!progress) return null;

  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Modal
      title={fileManager.actions.batchDownload}
      open={visible}
      onCancel={onClose}
      footer={null}
      closable={progress.completed || !!progress.error}
      maskClosable={false}
      width={500}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {progress.error ? (
          <Alert
            message={fileManager.messages.batchDownloadFailed}
            description={progress.error}
            type="error"
            showIcon
          />
        ) : progress.completed ? (
          <>
            <Alert
              message={fileManager.messages.batchDownloadCompleted}
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
            />
            <Progress percent={100} status="success" />
          </>
        ) : (
          <>
            <Space>
              <LoadingOutlined />
              <Text>
                {fileManager.messages.batchDownloadProgress
                  .replace('{current}', progress.current.toString())
                  .replace('{total}', progress.total.toString())}
              </Text>
            </Space>
            
            <Progress 
              percent={percentage} 
              status="active"
              format={(percent) => `${percent}% (${progress.current}/${progress.total})`}
            />
            
            {progress.currentFile && (
              <Text type="secondary" ellipsis title={progress.currentFile}>
                正在下载: {progress.currentFile}
              </Text>
            )}
          </>
        )}
      </Space>
    </Modal>
  );
};

export default BatchDownloadModal;
