import React from 'react';
import { Modal, Input, Button, Upload, List, Typography } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { ConnectionExportItem } from '../utils/connectionExport';
import { getConnectionIcon } from '../utils.tsx';
import { useAppI18n } from '../../../i18n/hooks/useI18n';

const { Text } = Typography;

interface ConnectionImportModalProps {
  open: boolean;
  preview: ConnectionExportItem[];
  error: string | null;
  importing: boolean;
  onParseText: (text: string) => void;
  onImportFile: (file: File) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConnectionImportModal: React.FC<ConnectionImportModalProps> = ({
  open,
  preview,
  error,
  importing,
  onParseText,
  onImportFile,
  onConfirm,
  onClose,
}) => {
  const { connection: i18n } = useAppI18n();

  const getProtocolLabel = (protocolType: string) => {
    switch (protocolType) {
      case 's3':
        return i18n.modal.protocolS3;
      case 'fs':
        return i18n.modal.protocolFs;
      case 'ftp':
        return i18n.modal.protocolFtp;
      default:
        return protocolType.toUpperCase();
    }
  };

  return (
    <Modal
      title={i18n.import.modalTitle}
      open={open}
      onCancel={onClose}
      onOk={onConfirm}
      okText={i18n.import.confirmButton}
      cancelText={i18n.import.cancelButton}
      okButtonProps={{ disabled: preview.length === 0, loading: importing }}
      width={640}
    >
      <p style={{ marginBottom: 12, color: '#666' }}>{i18n.import.modalDescription}</p>

      <Input.TextArea
        placeholder={i18n.import.pastePlaceholder}
        autoSize={{ minRows: 6, maxRows: 12 }}
        onChange={(event) => onParseText(event.target.value)}
        style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 12 }}
      />

      <div style={{ marginBottom: 16 }}>
        <Upload
          beforeUpload={(file) => {
            onImportFile(file);
            return false;
          }}
          showUploadList={false}
          accept=".json,application/json"
        >
          <Button icon={<UploadOutlined />}>{i18n.import.selectFileButton}</Button>
        </Upload>
      </div>

      {error && (
        <Text type="danger" style={{ display: 'block', marginBottom: 12 }}>
          {error}
        </Text>
      )}

      {preview.length > 0 && (
        <>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            {i18n.import.previewTitle.replace('{count}', String(preview.length))}
          </Text>
          <List
            size="small"
            bordered
            dataSource={preview}
            renderItem={(item) => (
              <List.Item>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {getConnectionIcon(item.protocol_type)}
                  <span>{item.name}</span>
                  <Text type="secondary">({getProtocolLabel(item.protocol_type)})</Text>
                </div>
              </List.Item>
            )}
          />
        </>
      )}
    </Modal>
  );
};
