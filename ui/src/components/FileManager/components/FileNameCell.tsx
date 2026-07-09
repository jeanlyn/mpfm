import React from 'react';
import { Space } from 'antd';
import {
  FolderOutlined,
  FileOutlined,
  DragOutlined,
} from '@ant-design/icons';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { FileInfo } from '../../../types';
import {
  DND_TYPES,
  remoteFileDragId,
} from '../../../dnd/types';

interface FileNameCellProps {
  connectionId: string;
  text: string;
  record: FileInfo;
  onDoubleClick: (file: FileInfo) => void;
}

export const FileNameCell: React.FC<FileNameCellProps> = ({
  connectionId,
  text,
  record,
  onDoubleClick,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: remoteFileDragId(connectionId, record.path),
    data: {
      type: DND_TYPES.REMOTE_FILE,
      connectionId,
      files: [record],
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Space ref={setNodeRef} style={style} className="file-name-cell">
      <span
        className="file-name-cell__drag-handle"
        {...listeners}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <DragOutlined />
      </span>
      {record.is_dir ? (
        <FolderOutlined style={{ color: '#1890ff' }} />
      ) : (
        <FileOutlined style={{ color: '#666' }} />
      )}
      <span
        style={{ cursor: 'pointer' }}
        onDoubleClick={() => onDoubleClick(record)}
        title={text}
      >
        {text}
      </span>
    </Space>
  );
};
