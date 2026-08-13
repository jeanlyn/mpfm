import React, { useState } from 'react';
import { Alert, ConfigProvider, Modal, Segmented, Select, Space, Table, theme, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAppI18n } from '../../i18n/hooks/useI18n';
import type { BatchUploadItem } from './types';

const { Text } = Typography;

type BatchUploadAction = 'skip' | 'overwrite';

interface BatchUploadConflictModalProps {
  items: BatchUploadItem[];
  onCancel: () => void;
  onConfirm: (items: BatchUploadItem[]) => void;
}

const BatchUploadConflictModal: React.FC<BatchUploadConflictModalProps> = ({
  items,
  onCancel,
  onConfirm,
}) => {
  const { app, fileManager } = useAppI18n();
  const { token } = theme.useToken();
  const [decisions, setDecisions] = useState<Record<string, BatchUploadAction>>({});
  const conflicts = items.filter((item) => item.conflict);
  const fileConflicts = conflicts.filter((item) => item.conflict === 'file');

  const actionFor = (item: BatchUploadItem): BatchUploadAction =>
    item.conflict === 'directory' ? 'skip' : (decisions[item.localPath] ?? 'skip');

  const setAll = (action: BatchUploadAction) => setDecisions(
    action === 'overwrite'
      ? Object.fromEntries(fileConflicts
        .map((item) => [item.localPath, action]))
      : {}
  );

  const columns: ColumnsType<BatchUploadItem> = [
    {
      title: fileManager.batchUpload.file,
      dataIndex: 'fileName',
      key: 'fileName',
      width: '34%',
      render: (name: string, item) => (
        <div style={{ minWidth: 0 }}>
          <Text ellipsis title={name} style={{ display: 'block' }}>{name}</Text>
          <Text type="secondary" ellipsis title={item.localPath} style={{ display: 'block', fontSize: 12 }}>
            {item.localPath}
          </Text>
        </div>
      ),
    },
    {
      title: fileManager.batchUpload.remotePath,
      dataIndex: 'remotePath',
      key: 'remotePath',
      render: (path: string, item) => (
        <div style={{ minWidth: 0 }}>
          <Text code ellipsis title={path} style={{ display: 'block' }}>{path}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {item.conflict === 'directory'
              ? fileManager.batchUpload.directoryConflict
              : fileManager.batchUpload.fileConflict}
          </Text>
        </div>
      ),
    },
    {
      title: fileManager.batchUpload.action,
      key: 'action',
      width: 150,
      render: (_, item) => (
        <Segmented<BatchUploadAction>
          size="small"
          value={actionFor(item)}
          options={[
            { value: 'skip', label: fileManager.batchUpload.skip },
            {
              value: 'overwrite',
              label: fileManager.batchUpload.overwrite,
              disabled: item.conflict === 'directory',
            },
          ]}
          onChange={(action) => setDecisions((current) => ({
            ...current,
            [item.localPath]: action,
          }))}
        />
      ),
    },
  ];

  return (
    <ConfigProvider
      theme={{
        components: {
          Segmented: {
            itemSelectedBg: token.colorPrimary,
            itemSelectedColor: token.colorTextLightSolid,
          },
        },
      }}
    >
      <Modal
        open
        width="calc(100vw - 32px)"
        style={{ top: 20, maxWidth: 1120 }}
        title={(
          <div>
            <div>{fileManager.batchUpload.conflictTitle}</div>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              {fileManager.batchUpload.conflictDescription}
            </Text>
          </div>
        )}
        onCancel={onCancel}
        cancelText={app.cancel}
        okText={fileManager.batchUpload.startUpload}
        onOk={() => onConfirm(items.filter((item) =>
          !item.conflict || actionFor(item) === 'overwrite'
        ))}
      >
        {conflicts.some((item) => item.conflict === 'directory') && (
          <Alert
            type="warning"
            showIcon
            message={fileManager.batchUpload.directoryConflictHint}
            style={{ marginBottom: 12 }}
          />
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <Text>
            {fileManager.batchUpload.conflictCount.replace('{count}', String(conflicts.length))}
          </Text>
          <Space>
            <Text type="secondary">{fileManager.batchUpload.defaultAction}</Text>
            <Select<BatchUploadAction>
              defaultValue="skip"
              style={{ width: 100 }}
              options={[
                { value: 'skip', label: fileManager.batchUpload.skip },
                {
                  value: 'overwrite',
                  label: fileManager.batchUpload.overwrite,
                  disabled: fileConflicts.length === 0,
                },
              ]}
              onSelect={setAll}
            />
          </Space>
        </div>
        <Table
          rowKey="localPath"
          columns={columns}
          dataSource={conflicts}
          pagination={false}
          size="small"
          scroll={{
            x: 700,
            y: 'max(160px, calc(100vh - 340px))',
          }}
        />
      </Modal>
    </ConfigProvider>
  );
};

export default BatchUploadConflictModal;
