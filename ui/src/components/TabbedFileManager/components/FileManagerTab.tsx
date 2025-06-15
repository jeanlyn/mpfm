import React from 'react';
import { Connection } from '../../../types';
import FileManager from '../../FileManager';
import FileManagerModular from '../../FileManager/FileManagerModular';

interface FileManagerTabProps {
  connection: Connection;
  visible: boolean;
}

/**
 * 文件管理器Tab内容组件
 * 用于包装FileManager组件，控制其显示状态
 * 为了避免切换时重新加载，所有Tab都会渲染但通过CSS控制显示
 */
const FileManagerTab: React.FC<FileManagerTabProps> = ({ 
  connection, 
  visible 
}) => {
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
        visibility: visible ? 'visible' : 'hidden',
        opacity: visible ? 1 : 0,
        zIndex: visible ? 1 : 0,
      }}
    >
      <FileManagerModular connection={connection} />
    </div>
  );
};

export default FileManagerTab;
