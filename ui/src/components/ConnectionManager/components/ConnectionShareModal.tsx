import React from 'react';
import { Modal, Button, Space } from 'antd';
import { AppInput } from '../../common';
import { CopyOutlined, DownloadOutlined } from '@ant-design/icons';
import { useAppI18n } from '../../../i18n/hooks/useI18n';

interface ConnectionShareModalProps {
  open: boolean;
  content: string;
  onCopy: () => void;
  onDownload: () => void;
  onClose: () => void;
}

export const ConnectionShareModal: React.FC<ConnectionShareModalProps> = ({
  open,
  content,
  onCopy,
  onDownload,
  onClose,
}) => {
  const { connection: i18n } = useAppI18n();

  return (
    <Modal
      title={i18n.share.modalTitle}
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          {i18n.share.closeButton}
        </Button>,
        <Button key="download" icon={<DownloadOutlined />} onClick={onDownload}>
          {i18n.share.downloadButton}
        </Button>,
        <Button key="copy" type="primary" icon={<CopyOutlined />} onClick={onCopy}>
          {i18n.share.copyButton}
        </Button>,
      ]}
      width={640}
    >
      <p style={{ marginBottom: 12, color: '#666' }}>{i18n.share.modalDescription}</p>
      <AppInput.TextArea
        value={content}
        readOnly
        autoSize={{ minRows: 12, maxRows: 20 }}
        style={{ fontFamily: 'monospace', fontSize: 12 }}
      />
      <div style={{ marginTop: 12 }}>
        <Space>
          <Button icon={<CopyOutlined />} onClick={onCopy}>
            {i18n.share.copyButton}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={onDownload}>
            {i18n.share.downloadButton}
          </Button>
        </Space>
      </div>
    </Modal>
  );
};
