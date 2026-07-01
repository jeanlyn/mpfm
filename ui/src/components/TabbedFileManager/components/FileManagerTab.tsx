import React, { useEffect, useState } from 'react';
import { Connection } from '../../../types';
import FileManagerModular from '../../FileManager/FileManagerModular';

interface FileManagerTabProps {
  connection: Connection;
  visible: boolean;
}

const FileManagerTab: React.FC<FileManagerTabProps> = ({ connection, visible }) => {
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }
  }, [visible]);

  if (!mounted) {
    return null;
  }

  return (
    <div
      className="file-manager-tab"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: visible ? 'block' : 'none',
      }}
    >
      <FileManagerModular connection={connection} />
    </div>
  );
};

export default React.memo(
  FileManagerTab,
  (prev, next) =>
    prev.visible === next.visible &&
    prev.connection.id === next.connection.id &&
    prev.connection.config?.bucket === next.connection.config?.bucket
);
