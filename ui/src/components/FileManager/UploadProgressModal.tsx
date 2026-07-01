import React, { useEffect, useRef, useState } from 'react';
import { Modal, Progress, Typography, Space, Alert, Button } from 'antd';
import {
  CheckCircleOutlined,
  LoadingOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useAppI18n } from '../../i18n/hooks/useI18n';
import { ApiService } from '../../services/api';
import { UploadProgress, formatUploadSpeed } from '../../utils/uploadProgress';
import { formatFileSize } from '../../utils/batchDownload';

const { Text } = Typography;

/** 至少经过该时长后才显示速度，避免初始采样抖动 */
const MIN_SPEED_SAMPLE_MS = 500;

interface UploadProgressModalProps {
  visible: boolean;
  progress: UploadProgress | null;
  onClose: () => void;
}

const UploadProgressModal: React.FC<UploadProgressModalProps> = ({
  visible,
  progress,
  onClose,
}) => {
  const { fileManager } = useAppI18n();
  const [speed, setSpeed] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const fileKeyRef = useRef<string>('');

  useEffect(() => {
    if (!progress || progress.completed || progress.error) {
      setSpeed(0);
      startTimeRef.current = null;
      fileKeyRef.current = '';
      return;
    }

    const now = Date.now();
    const fileKey = `${progress.fileIndex ?? 0}:${progress.fileName}`;

    // 新文件开始时重置计时，避免目录上传时把多个文件的速度混在一起
    if (fileKeyRef.current !== fileKey) {
      fileKeyRef.current = fileKey;
      startTimeRef.current = now;
      setSpeed(0);
      return;
    }

    if (startTimeRef.current === null) {
      startTimeRef.current = now;
    }

    const elapsedMs = now - startTimeRef.current;
    if (elapsedMs >= MIN_SPEED_SAMPLE_MS && progress.transferred > 0) {
      // 使用平均速度（总传输量 / 总耗时），单位始终为 bytes/s
      setSpeed(progress.transferred / (elapsedMs / 1000));
    }
  }, [progress]);

  // 上传结束（完成/取消/出错）后重置取消按钮状态
  useEffect(() => {
    if (progress?.completed || progress?.cancelled) {
      setCancelling(false);
    }
  }, [progress?.completed, progress?.cancelled]);

  const handleCancel = async () => {
    if (!progress?.uploadId || cancelling) return;
    setCancelling(true);
    try {
      await ApiService.cancelUpload(progress.uploadId);
      // 后端置位取消标志后，会在下一个分块检查点中止上传并下发 cancelled 事件，
      // 这里不主动关闭 modal，等待后端确认后再切换到"已取消"态。
    } catch (error) {
      setCancelling(false);
      console.error('取消上传失败:', error);
    }
  };

  if (!progress) return null;

  const percentage =
    progress.total > 0
      ? Math.min(100, Math.round((progress.transferred / progress.total) * 100))
      : 0;

  const isDirectoryUpload =
    progress.fileIndex !== undefined && progress.fileCount !== undefined;

  // 目录上传完成事件会携带 uploadedCount/failedCount，用于区分"部分成功"
  const hasDirectorySummary =
    progress.uploadedCount !== undefined && progress.failedCount !== undefined;

  // 进行中或取消中时不可直接关闭，只能取消或等待
  const isFinished = progress.completed || !!progress.error || !!progress.cancelled;

  return (
    <Modal
      title={fileManager.actions.upload}
      open={visible}
      onCancel={onClose}
      footer={null}
      closable={isFinished}
      maskClosable={false}
      width={500}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {progress.cancelled ? (
          <>
            <Alert
              message={fileManager.messages.uploadCancelled}
              type="info"
              showIcon
              icon={<StopOutlined />}
            />
            <Progress percent={percentage} status="normal" />
          </>
        ) : progress.error ? (
          <Alert
            message={
              hasDirectorySummary
                ? fileManager.messages.uploadDirectoryPartialSuccess
                    .replace('{uploaded}', String(progress.uploadedCount))
                    .replace('{failed}', String(progress.failedCount))
                    .replace('{total}', String(progress.fileCount))
                : fileManager.messages.uploadFailed
            }
            description={progress.error}
            type={hasDirectorySummary ? 'warning' : 'error'}
            showIcon
          />
        ) : progress.completed ? (
          <>
            <Alert
              message={fileManager.messages.uploadSuccess}
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
            />
            <Progress percent={100} status="success" />
          </>
        ) : (
          <>
            <Space>
              {cancelling ? null : <LoadingOutlined />}
              <Text>
                {cancelling
                  ? fileManager.messages.uploadCancelling
                  : isDirectoryUpload
                    ? fileManager.messages.uploadDirectoryProgress
                        .replace('{current}', String(progress.fileIndex))
                        .replace('{total}', String(progress.fileCount))
                    : fileManager.messages.uploadingFile}
              </Text>
            </Space>

            <Progress
              percent={percentage}
              status={cancelling ? 'normal' : 'active'}
              format={(percent) =>
                progress.total > 0
                  ? `${percent}% (${formatFileSize(progress.transferred)} / ${formatFileSize(progress.total)})`
                  : `${percent}%`
              }
            />

            {speed > 0 && !cancelling && (
              <Text type="secondary">{formatUploadSpeed(speed)}</Text>
            )}

            {progress.fileName && (
              <Text type="secondary" ellipsis title={progress.fileName}>
                {fileManager.messages.uploadingCurrentFile.replace(
                  '{fileName}',
                  progress.fileName
                )}
              </Text>
            )}

            <Button
              danger
              icon={<StopOutlined />}
              loading={cancelling}
              disabled={cancelling}
              onClick={handleCancel}
              block
            >
              {fileManager.messages.uploadCancel}
            </Button>
          </>
        )}
      </Space>
    </Modal>
  );
};

export default UploadProgressModal;
