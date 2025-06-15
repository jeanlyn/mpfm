import { useCallback } from 'react';
import { message } from 'antd';
import { Connection } from '../../../types';
import { ApiService } from '../../../services/api';
import { useAppI18n } from '../../../i18n/hooks/useI18n';
import { PaginatedFileList } from '../types';

/**
 * 搜索和分页相关的 Hook
 */
export const useSearchAndPagination = (
  connection: Connection | null,
  currentPath: string,
  pageSize: number,
  searchQuery: string,
  onStateUpdate: (updates: any) => void,
  chooseLoadingMode: (path: string) => Promise<'pagination' | 'all'>
) => {
  const { fileManager } = useAppI18n();

  // 搜索功能
  const handleSearch = useCallback(async (page: number = 0) => {
    if (!connection || !searchQuery.trim()) return;

    onStateUpdate({ loading: true, isSearchMode: true });
    
    try {
      const result: PaginatedFileList = await ApiService.searchFiles(
        connection.id, 
        currentPath,
        searchQuery.trim(), 
        page, 
        pageSize
      );
      
      onStateUpdate({
        searchResults: result.files,
        searchTotal: result.total,
        searchPage: result.page,
      });
    } catch (error) {
      message.error(`${fileManager.messages.searchFailed}: ${error}`);
    } finally {
      onStateUpdate({ loading: false });
    }
  }, [connection, currentPath, searchQuery, pageSize, onStateUpdate, fileManager.messages.searchFailed]);

  // 处理普通文件列表分页
  const handlePageChange = useCallback(async (page: number, size?: number) => {
    if (size && size !== pageSize) {
      onStateUpdate({ pageSize: size, currentPage: 0 });
      // 使用新的pageSize立即加载文件
      await loadFilesWithNewPageSize(currentPath, 0, size);
      return;
    }
    
    const targetPage = page - 1; // Pagination组件从1开始，API从0开始
    onStateUpdate({ currentPage: targetPage });
    await loadFilesWithPageSize(currentPath, targetPage, pageSize);
  }, [currentPath, pageSize, onStateUpdate]);

  // 使用新的pageSize加载文件的辅助函数
  const loadFilesWithNewPageSize = useCallback(async (path: string, page: number = 0, newPageSize: number) => {
    if (!connection) return;
    
    onStateUpdate({ loading: true });
    
    try {
      const mode = await chooseLoadingMode(path);
      
      if (mode === 'pagination') {
        // 分页模式，使用新的pageSize
        const result: PaginatedFileList = await ApiService.listFilesPaginated(
          connection.id, 
          path, 
          page, 
          newPageSize
        );
        
        onStateUpdate({
          files: result.files,
          totalFiles: result.total,
          currentPage: result.page,
          currentPath: path,
        });
      } else {
        // 全量加载模式（适用于小目录）
        const fileList = await ApiService.listFiles(connection.id, path);
        onStateUpdate({
          files: fileList,
          totalFiles: fileList.length,
          currentPage: 0,
          currentPath: path,
        });
      }
      
    } catch (error) {
      message.error(`${fileManager.messages.loadFilesFailed}: ${error}`);
    } finally {
      onStateUpdate({ loading: false });
    }
  }, [connection, chooseLoadingMode, onStateUpdate, fileManager.messages.loadFilesFailed]);

  // 普通分页加载
  const loadFilesWithPageSize = useCallback(async (path: string, page: number = 0, size: number) => {
    if (!connection) return;
    
    onStateUpdate({ loading: true });
    
    try {
      const mode = await chooseLoadingMode(path);
      
      if (mode === 'pagination') {
        const result: PaginatedFileList = await ApiService.listFilesPaginated(
          connection.id, 
          path, 
          page, 
          size
        );
        
        onStateUpdate({
          files: result.files,
          totalFiles: result.total,
          currentPage: result.page,
        });
      } else {
        const fileList = await ApiService.listFiles(connection.id, path);
        onStateUpdate({
          files: fileList,
          totalFiles: fileList.length,
          currentPage: 0,
        });
      }
      
    } catch (error) {
      message.error(`${fileManager.messages.loadFilesFailed}: ${error}`);
    } finally {
      onStateUpdate({ loading: false });
    }
  }, [connection, chooseLoadingMode, onStateUpdate, fileManager.messages.loadFilesFailed]);

  // 处理搜索结果分页
  const handleSearchPageChange = useCallback(async (page: number, size?: number) => {
    if (size && size !== pageSize) {
      onStateUpdate({ pageSize: size });
      // 使用新的pageSize搜索
      await handleSearchWithNewPageSize(0, size);
      return;
    }
    
    const targetPage = page - 1; // Pagination组件从1开始，API从0开始
    await handleSearch(targetPage);
  }, [pageSize, handleSearch, onStateUpdate]);

  // 使用新的pageSize搜索的辅助函数
  const handleSearchWithNewPageSize = useCallback(async (page: number = 0, newPageSize: number) => {
    if (!connection || !searchQuery.trim()) return;

    onStateUpdate({ loading: true, isSearchMode: true });
    
    try {
      const result: PaginatedFileList = await ApiService.searchFiles(
        connection.id, 
        currentPath,
        searchQuery.trim(), 
        page, 
        newPageSize
      );
      
      onStateUpdate({
        searchResults: result.files,
        searchTotal: result.total,
        searchPage: result.page,
      });
    } catch (error) {
      message.error(`${fileManager.messages.searchFailed}: ${error}`);
    } finally {
      onStateUpdate({ loading: false });
    }
  }, [connection, currentPath, searchQuery, onStateUpdate, fileManager.messages.searchFailed]);

  // 重置搜索
  const handleSearchReset = useCallback(async () => {
    onStateUpdate({
      isSearchMode: false,
      searchQuery: '',
      searchResults: [],
      searchPage: 0,
      searchTotal: 0,
    });
    await loadFilesWithPageSize(currentPath, 0, pageSize);
  }, [currentPath, pageSize, loadFilesWithPageSize, onStateUpdate]);

  return {
    handleSearch,
    handlePageChange,
    handleSearchPageChange,
    handleSearchReset,
    loadFilesWithNewPageSize,
    handleSearchWithNewPageSize,
  };
};
