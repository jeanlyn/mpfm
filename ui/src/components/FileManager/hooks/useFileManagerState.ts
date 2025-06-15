import { useState, useCallback } from 'react';
import { FileManagerState } from '../types';
import { DEFAULT_PAGE_SIZE, DEFAULT_TABLE_HEIGHT } from '../constants';

/**
 * FileManager 状态管理 Hook
 */
export const useFileManagerState = () => {
  const [state, setState] = useState<FileManagerState>({
    files: [],
    currentPath: '/',
    loading: false,
    createDirModalOpen: false,
    newDirName: '',
    
    // 分页相关状态
    currentPage: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    totalFiles: 0,
    loadingMode: 'pagination',
    
    // 搜索相关状态
    searchQuery: '',
    isSearchMode: false,
    searchResults: [],
    searchPage: 0,
    searchTotal: 0,
    
    // 预览相关状态
    previewVisible: false,
    previewFile: null,
    
    // 批量下载相关状态
    batchDownloadVisible: false,
    batchDownloadProgress: null,
    
    // 动态计算表格高度
    tableHeight: DEFAULT_TABLE_HEIGHT,
  });

  // 更新单个状态字段
  const updateState = useCallback(<K extends keyof FileManagerState>(
    key: K,
    value: FileManagerState[K]
  ) => {
    setState(prevState => ({
      ...prevState,
      [key]: value,
    }));
  }, []);

  // 批量更新状态
  const updateMultipleState = useCallback((updates: Partial<FileManagerState>) => {
    setState(prevState => ({
      ...prevState,
      ...updates,
    }));
  }, []);

  // 重置状态
  const resetState = useCallback(() => {
    setState({
      files: [],
      currentPath: '/',
      loading: false,
      createDirModalOpen: false,
      newDirName: '',
      currentPage: 0,
      pageSize: DEFAULT_PAGE_SIZE,
      totalFiles: 0,
      loadingMode: 'pagination',
      searchQuery: '',
      isSearchMode: false,
      searchResults: [],
      searchPage: 0,
      searchTotal: 0,
      previewVisible: false,
      previewFile: null,
      batchDownloadVisible: false,
      batchDownloadProgress: null,
      tableHeight: DEFAULT_TABLE_HEIGHT,
    });
  }, []);

  return {
    state,
    updateState,
    updateMultipleState,
    resetState,
  };
};
