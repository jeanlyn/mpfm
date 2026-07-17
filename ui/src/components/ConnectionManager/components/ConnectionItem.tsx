import React, { useMemo, useState } from 'react';
import {
  Button,
  Tooltip,
  Dropdown,
  Modal,
  Spin,
  Popover,
} from 'antd';
import { AppInput } from '../../common';
import type { MenuProps } from 'antd';
import {
  EditOutlined,
  CopyOutlined,
  ShareAltOutlined,
  DeleteOutlined,
  DragOutlined,
  MoreOutlined,
  ReloadOutlined,
  DownOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ConnectionItemProps } from '../types';
import { getConnectionIcon } from '../utils.tsx';
import { useAppI18n } from '../../../i18n/hooks/useI18n';
import {
  DND_TYPES,
  connectionDropId,
} from '../../../dnd/types';
import './ConnectionItem.css';

export const ConnectionItem: React.FC<ConnectionItemProps> = ({
  connection,
  directoryId,
  isActive,
  isS3,
  bucketExpanded,
  buckets,
  bucketLoading,
  bucketLoadFailed,
  bucketSwitching,
  bucketCreating,
  onSelect,
  onEdit,
  onCopy,
  onShare,
  onDelete,
  onToggleBucket,
  onRefreshBuckets,
  onBucketSwitch,
  onBucketCreate,
}) => {
  const { connection: i18n, app, fileManager } = useAppI18n();
  const { s3Buckets: bucketI18n } = i18n;
  const [createOpen, setCreateOpen] = useState(false);
  const [bucketInput, setBucketInput] = useState('');

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: connection.id,
    data: {
      type: DND_TYPES.CONNECTION_SORT,
      connection,
      directoryId,
    },
  });

  const { setNodeRef: setDropRef, isOver, active } = useDroppable({
    id: connectionDropId(connection.id),
    data: {
      type: DND_TYPES.CONNECTION_DROP,
      connection,
    },
  });

  const isFileDropTarget =
    isOver && active?.data.current?.type === DND_TYPES.REMOTE_FILE;

  const setNodeRef = (node: HTMLElement | null) => {
    setSortableRef(node);
    setDropRef(node);
  };

  const currentBucket = connection.config.bucket || '';

  const moreMenu: MenuProps = useMemo(
    () => ({
      items: [
        {
          key: 'copy',
          icon: <CopyOutlined />,
          label: i18n.tooltips.copyConnection,
          onClick: ({ domEvent }) => {
            domEvent.stopPropagation();
            onCopy();
          },
        },
        {
          key: 'share',
          icon: <ShareAltOutlined />,
          label: i18n.tooltips.shareConnection,
          onClick: ({ domEvent }) => {
            domEvent.stopPropagation();
            onShare();
          },
        },
        { type: 'divider' },
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: i18n.tooltips.deleteConnection,
          danger: true,
          onClick: ({ domEvent }) => {
            domEvent.stopPropagation();
            Modal.confirm({
              title: i18n.tooltips.confirmDeleteConnection,
              okText: app.confirm,
              cancelText: app.cancel,
              onOk: onDelete,
            });
          },
        },
      ],
    }),
    [i18n, app, onCopy, onShare, onDelete]
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleTagClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isActive) {
      onSelect();
    }
    onToggleBucket();
  };

  const handleCreateConfirm = async () => {
    const trimmed = bucketInput.trim();
    if (!trimmed) return;

    await onBucketCreate(trimmed);
    setBucketInput('');
    setCreateOpen(false);
  };

  const createPopoverContent = (
    <div className="connection-item__manage-popover" onClick={(e) => e.stopPropagation()}>
      <AppInput
        size="small"
        placeholder={bucketI18n.createPlaceholder}
        value={bucketInput}
        onChange={(e) => setBucketInput(e.target.value)}
        onPressEnter={handleCreateConfirm}
        disabled={bucketCreating}
      />
      <div className="connection-item__manage-actions">
        <Button size="small" onClick={() => setCreateOpen(false)}>
          {app.cancel}
        </Button>
        <Button
          size="small"
          type="primary"
          loading={bucketCreating}
          onClick={handleCreateConfirm}
        >
          {bucketI18n.create}
        </Button>
      </div>
    </div>
  );

  const showBucketPanel = isS3 && isActive && bucketExpanded;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={[
        'connection-item',
        isActive ? 'connection-item--active' : '',
        isDragging ? 'connection-item--dragging' : '',
        isFileDropTarget ? 'connection-item--drop-target' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onSelect}
    >
      <div className="connection-item__main">
        <div
          className="connection-item__drag"
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <DragOutlined />
        </div>

        <div className="connection-item__icon">
          {getConnectionIcon(connection.protocol_type)}
        </div>

        <div className="connection-item__body">
          <Tooltip
            title={
              isFileDropTarget
                ? fileManager.messages.dragFileToConnection
                : `${connection.name} (${connection.protocol_type.toUpperCase()})`
            }
            placement="top"
          >
            <span className="connection-item__name">{connection.name}</span>
          </Tooltip>

          {isS3 && (
            <Tooltip title={currentBucket || bucketI18n.noBucket}>
              <span className="connection-item__bucket" onClick={handleTagClick}>
                {currentBucket || bucketI18n.noBucket}
                {isActive && (
                  <DownOutlined
                    className={[
                      'connection-item__bucket-chevron',
                      bucketExpanded ? 'connection-item__bucket-chevron--expanded' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                )}
              </span>
            </Tooltip>
          )}
        </div>

        <div className="connection-item__actions" onClick={(e) => e.stopPropagation()}>
          <Tooltip title={i18n.tooltips.editConnection}>
            <Button
              className="connection-item__action-btn"
              icon={<EditOutlined />}
              size="small"
              type="text"
              onClick={onEdit}
              style={{ color: '#1890ff' }}
            />
          </Tooltip>
          <Dropdown menu={moreMenu} trigger={['click']} placement="bottomRight">
            <Tooltip title={i18n.tooltips.moreActions}>
              <Button
                className="connection-item__action-btn"
                icon={<MoreOutlined />}
                size="small"
                type="text"
                style={{ color: '#666' }}
              />
            </Tooltip>
          </Dropdown>
        </div>
      </div>

      {showBucketPanel && (
        <div className="connection-item__bucket-panel" onClick={(e) => e.stopPropagation()}>
          <div className="connection-item__bucket-header">
            <span className="connection-item__bucket-title">{bucketI18n.title}</span>
            <Tooltip title={bucketI18n.refresh}>
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined />}
                loading={bucketLoading}
                onClick={onRefreshBuckets}
                style={{ padding: '0 4px', height: 20, minWidth: 'unset' }}
              />
            </Tooltip>
          </div>

          {bucketLoading && buckets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <Spin size="small" />
            </div>
          ) : buckets.length === 0 ? (
            <div className="connection-item__bucket-empty">{bucketI18n.empty}</div>
          ) : (
            <div className="connection-item__bucket-list">
              {buckets.map((bucket) => (
                <div
                  key={bucket}
                  className={[
                    'connection-item__bucket-row',
                    bucket === currentBucket ? 'connection-item__bucket-row--current' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    if (!bucketSwitching) onBucketSwitch(bucket);
                  }}
                >
                  {bucket === currentBucket ? `${bucket} (${bucketI18n.current})` : bucket}
                </div>
              ))}
            </div>
          )}

          {bucketLoadFailed && (
            <div className="connection-item__bucket-warning">{bucketI18n.loadFailedHint}</div>
          )}

          <Popover
            open={createOpen}
            onOpenChange={setCreateOpen}
            trigger="click"
            placement="bottomLeft"
            content={createPopoverContent}
          >
            <Button
              className="connection-item__manage-btn"
              size="small"
              icon={<PlusOutlined />}
              onClick={(e) => e.stopPropagation()}
            >
              {bucketI18n.create}
            </Button>
          </Popover>
        </div>
      )}
    </div>
  );
};
