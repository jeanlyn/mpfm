import React from 'react';
import { CloudUploadOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import { useAppI18n } from '../../../i18n/hooks/useI18n';

interface DragUploadOverlayProps {
  visible: boolean;
}

const DragUploadOverlay: React.FC<DragUploadOverlayProps> = ({ visible }) => {
  const { fileManager } = useAppI18n();

  if (!visible) {
    return null;
  }

  return (
    <div className="file-manager-drag-overlay" aria-hidden="true">
      <div className="file-manager-drag-overlay__content">
        <CloudUploadOutlined className="file-manager-drag-overlay__icon" />
        <Typography.Title level={4} className="file-manager-drag-overlay__title">
          {fileManager.messages.dragDropRelease}
        </Typography.Title>
        <Typography.Text type="secondary">
          {fileManager.messages.dragDropHint}
        </Typography.Text>
      </div>
    </div>
  );
};

export default DragUploadOverlay;
