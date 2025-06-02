import React from 'react';
import { Button, Tooltip, Popconfirm } from 'antd';
import { 
  EditOutlined, 
  CopyOutlined, 
  DeleteOutlined, 
  DragOutlined 
} from '@ant-design/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DraggableConnectionProps } from '../types';
import { getConnectionIcon } from '../utils.tsx';

/**
 * 可拖拽的连接组件
 */
export const DraggableConnection: React.FC<DraggableConnectionProps> = ({ 
  connection, 
  directoryId, 
  onEdit, 
  onCopy, 
  onDelete 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: connection.id,
    data: {
      type: 'connection',
      connection,
      directoryId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="draggable-connection"
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        width: '100%',
        minHeight: '32px',
        padding: '4px 8px',
        borderRadius: '4px',
        backgroundColor: isDragging ? '#f0f0f0' : 'transparent',
        border: isDragging ? '1px dashed #d9d9d9' : '1px solid transparent',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <div {...listeners} style={{ cursor: 'grab', marginRight: '8px', color: '#999' }}>
            <DragOutlined />
          </div>
          {getConnectionIcon(connection.protocol_type)}
          <Tooltip title={`${connection.name} (${connection.protocol_type.toUpperCase()})`} placement="top">
            <span style={{ 
              flex: '1', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
              marginLeft: '8px',
              minWidth: '0'
            }}>
              {connection.name}
            </span>
          </Tooltip>
        </div>
        <div style={{ 
          display: 'flex', 
          gap: '4px', 
          flexShrink: 0
        }}>
          <Tooltip title="编辑连接">
            <Button
              icon={<EditOutlined />}
              size="small"
              type="text"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              style={{ 
                padding: '0 4px',
                minWidth: 'unset',
                height: '24px',
                color: '#1890ff'
              }}
            />
          </Tooltip>
          <Tooltip title="复制连接">
            <Button
              icon={<CopyOutlined />}
              size="small"
              type="text"
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
              style={{ 
                padding: '0 4px',
                minWidth: 'unset',
                height: '24px',
                color: '#52c41a'
              }}
            />
          </Tooltip>
          <Tooltip title="删除连接">
            <Popconfirm
              title="确定要删除这个连接吗？"
              onConfirm={(e) => {
                e?.stopPropagation();
                onDelete();
              }}
              onCancel={(e) => e?.stopPropagation()}
            >
              <Button
                icon={<DeleteOutlined />}
                size="small"
                type="text"
                onClick={(e) => e.stopPropagation()}
                style={{ 
                  padding: '0 4px',
                  minWidth: 'unset',
                  height: '24px',
                  color: '#ff4d4f'
                }}
              />
            </Popconfirm>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};
