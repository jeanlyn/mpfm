import React from 'react';
import { Button, Tooltip, Popconfirm } from 'antd';
import { 
  PlusOutlined,
  EditOutlined, 
  DeleteOutlined 
} from '@ant-design/icons';
import { useSortable } from '@dnd-kit/sortable';
import { DroppableDirectoryProps } from '../types';
import { useAppI18n } from '../../../i18n/hooks/useI18n';

/**
 * 可拖拽放置的目录组件
 */
export const DroppableDirectory: React.FC<DroppableDirectoryProps & { 
  onAddConnection: () => void;
}> = ({ 
  directory, 
  children, 
  onToggle, 
  onEdit, 
  onDelete,
  onAddConnection 
}) => {
  const { connection } = useAppI18n();
  const {
    setNodeRef,
    isOver,
  } = useSortable({
    id: `dir-${directory.id}`,
    data: {
      type: 'directory',
      directory,
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        backgroundColor: isOver ? '#e6f7ff' : 'transparent',
        border: isOver ? '2px dashed #1890ff' : '2px solid transparent',
        borderRadius: '4px',
        padding: '4px',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        fontWeight: '500',
        padding: '4px 8px',
        borderRadius: '4px',
        backgroundColor: isOver ? '#f0f9ff' : 'transparent',
      }}>
        <span 
          onClick={onToggle}
          style={{ flex: 1, cursor: 'pointer' }}
        >
          {directory.name} ({directory.connectionIds.length})
        </span>
        <div style={{ display: 'flex', gap: '2px' }}>
          <Tooltip title={connection.tooltips.addConnectionToDirectory}>
            <Button
              icon={<PlusOutlined />}
              size="small"
              type="text"
              onClick={(e) => {
                e.stopPropagation();
                onAddConnection();
              }}
              style={{ 
                padding: '0 2px',
                minWidth: 'unset',
                height: '20px',
                fontSize: '12px',
                color: '#52c41a'
              }}
            />
          </Tooltip>
          <Tooltip title={connection.tooltips.editDirectory}>
            <Button
              icon={<EditOutlined />}
              size="small"
              type="text"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              style={{ 
                padding: '0 2px',
                minWidth: 'unset',
                height: '20px',
                fontSize: '12px'
              }}
            />
          </Tooltip>
          {directory.id !== 'default' && (
            <Tooltip title={connection.tooltips.deleteDirectory}>
              <Popconfirm
                title={connection.tooltips.confirmDeleteDirectory}
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
                    padding: '0 2px',
                    minWidth: 'unset',
                    height: '20px',
                    fontSize: '12px',
                    color: '#ff4d4f'
                  }}
                />
              </Popconfirm>
            </Tooltip>
          )}
        </div>
      </div>
      {children}
    </div>
  );
};
