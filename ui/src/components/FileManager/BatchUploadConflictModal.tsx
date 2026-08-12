import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Modal, Select, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAppI18n } from '../../i18n/hooks/useI18n';

const { Text } = Typography;

export type BatchUploadAction = 'skip' | 'overwrite';

export interface BatchUploadItem {
  key: string;
  localPath: string;
  fileName: string;
  remotePath: string;
  conflict: 'file' | 'directory' | null;
  action: BatchUploadAction;
}

interface BatchUploadConflictModalProps {
  open: boolean;
  items: BatchUploadItem[];
  onCancel: () => void;
  onConfirm: (items: BatchUploadItem[]) => void;
}

const BatchUploadConflictModal: React.FC<BatchUploadConflictModalProps> = ({
  open,
  items,
  onCancel,
  onConfirm,
}) => {
  const { app, fileManager } = useAppI18n();
  const [decisions, setDecisions] = useState<Record<string, BatchUploadAction>>({});
  const conflicts = useMemo(() => items.filter((item) => item.conflict), [items]);

  useEffect(() => {
    if (open) setDecisions({});
  }, [open, items]);

  const actionFor = (item: BatchUploadItem): BatchUploadAction =>
    item.conflict === 'directory' ? 'skip' : (decisions[item.key] ?? item.action);

  const setAll = (action: BatchUploadAction) => {
    setDecisions(Object.fromEntries(
      conflicts.map((item) => [
        item.key,
        item.conflict === 'directory' ? 'skip' : action,
      ])
    ));
  };

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
        <Space.Compact>
          <Button
            size="small"
            type={actionFor(item) === 'skip' ? 'primary' : 'default'}
            onClick={() => setDecisions((current) => ({ ...current, [item.key]: 'skip' }))}
          >
            {fileManager.batchUpload.skip}
          </Button>
          <Button
            size="small"
            disabled={item.conflict === 'directory'}
            type={actionFor(item) === 'overwrite' ? 'primary' : 'default'}
            onClick={() => setDecisions((current) => ({ ...current, [item.key]: 'overwrite' }))}
          >
            {fileManager.batchUpload.overwrite}
          </Button>
        </Space.Compact>
      ),
    },
  ];

  return (
    <Modal
      open={open}
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
      destroyOnClose
      footer={(
        <Space>
          <Button onClick={onCancel}>{app.cancel}</Button>
          <Button
            type="primary"
            onClick={() => onConfirm(items.map((item) => ({ ...item, action: actionFor(item) })))}
          >
            {fileManager.batchUpload.startUpload}
          </Button>
        </Space>
      )}
    >
      {conflicts.some((item) => item.conflict === 'directory') && (
        <Alert
          type="warning"
          showIcon
          message={fileManager.batchUpload.directoryConflictHint}
          style={{ marginBottom: 12 }}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
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
              { value: 'overwrite', label: fileManager.batchUpload.overwrite },
            ]}
            onChange={setAll}
          />
        </Space>
      </div>
      <Table
        rowKey="key"
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
  );
};

export default BatchUploadConflictModal;
