import { useState, useCallback, useMemo } from 'react';
import { FileInfo } from '../types';

export interface FileSelectionState {
  selectedFiles: Set<string>;
  isAllSelected: boolean;
  hasSelection: boolean;
  selectedCount: number;
}

export interface FileSelectionActions {
  toggleFileSelection: (filePath: string) => void;
  toggleAllSelection: (files: FileInfo[]) => void;
  clearSelection: () => void;
  getSelectedFiles: (files: FileInfo[]) => FileInfo[];
}

export function useFileSelection(): FileSelectionState & FileSelectionActions {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const toggleFileSelection = useCallback((filePath: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }
      return newSet;
    });
  }, []);

  const toggleAllSelection = useCallback((files: FileInfo[]) => {
    setSelectedFiles(prev => {
      // 现在支持选择所有文件，包括文件夹
      const allDownloadableSelected = files.every(file => prev.has(file.path));
      
      const newSet = new Set(prev);
      
      if (allDownloadableSelected) {
        // 如果全部文件都被选中，则取消全选
        files.forEach(file => newSet.delete(file.path));
      } else {
        // 否则选中所有文件（包括文件夹）
        files.forEach(file => newSet.add(file.path));
      }
      
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set());
  }, []);

  const getSelectedFiles = useCallback((files: FileInfo[]) => {
    return files.filter(file => selectedFiles.has(file.path));
  }, [selectedFiles]);

  const state = useMemo(() => {
    const hasSelection = selectedFiles.size > 0;
    const selectedCount = selectedFiles.size;
    
    return {
      selectedFiles,
      isAllSelected: false, // 这个值在组件中根据当前页面的文件计算
      hasSelection,
      selectedCount,
    };
  }, [selectedFiles]);

  return {
    ...state,
    toggleFileSelection,
    toggleAllSelection,
    clearSelection,
    getSelectedFiles,
  };
}
