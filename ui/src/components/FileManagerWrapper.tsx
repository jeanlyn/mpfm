import React from 'react';
import { Connection } from '../types';

// 导入两个版本的文件管理器
import FileManager from './FileManager';
import AdvancedFileManager from './AdvancedFileManager';

interface FileManagerWrapperProps {
  connection: Connection | null;
  useAdvancedMode?: boolean;
}

const FileManagerWrapper: React.FC<FileManagerWrapperProps> = ({ 
  connection, 
  useAdvancedMode = true // 默认使用高级模式
}) => {
  return useAdvancedMode ? (
    <AdvancedFileManager connection={connection} />
  ) : (
    <FileManager connection={connection} />
  );
};

export default FileManagerWrapper;