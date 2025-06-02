import { useState, useCallback } from 'react';
import { message } from 'antd';
import { DirectoryItem } from '../types';
import { Connection } from '../../../types';

/**
 * 目录管理相关的Hook
 */
export const useDirectories = (connections: Connection[]) => {
  const [directories, setDirectories] = useState<DirectoryItem[]>([]);

  // 从 localStorage 加载目录配置
  const loadDirectories = useCallback(() => {
    try {
      const saved = localStorage.getItem('mpfm_directories');
      if (saved) {
        const parsed = JSON.parse(saved);
        // 确保默认分组包含所有连接
        const updatedDirectories = parsed.map((dir: DirectoryItem) => {
          if (dir.id === 'default') {
            return {
              ...dir,
              connectionIds: connections.map(conn => conn.id) // 始终包含所有连接
            };
          }
          return dir;
        });
        setDirectories(updatedDirectories);
      } else {
        // 初始化默认目录
        const defaultDirectories: DirectoryItem[] = [
          {
            id: 'default',
            name: '默认分组',
            connectionIds: connections.map(conn => conn.id),
            expanded: true
          }
        ];
        setDirectories(defaultDirectories);
        localStorage.setItem('mpfm_directories', JSON.stringify(defaultDirectories));
      }
    } catch (error) {
      console.error('加载目录配置失败:', error);
      setDirectories([]);
    }
  }, [connections]);

  // 保存目录配置到 localStorage
  const saveDirectories = useCallback((dirs: DirectoryItem[]) => {
    try {
      // 确保默认分组始终包含所有连接
      const updatedDirs = dirs.map(dir => {
        if (dir.id === 'default') {
          return {
            ...dir,
            connectionIds: connections.map(conn => conn.id) // 始终包含所有连接
          };
        }
        return dir;
      });
      
      localStorage.setItem('mpfm_directories', JSON.stringify(updatedDirs));
      setDirectories(updatedDirs);
    } catch (error) {
      console.error('保存目录配置失败:', error);
      message.error('保存目录配置失败');
    }
  }, [connections]);

  // 目录切换
  const handleDirectoryToggle = useCallback((directoryId: string) => {
    const newDirectories = directories.map(dir => 
      dir.id === directoryId ? { ...dir, expanded: !dir.expanded } : dir
    );
    saveDirectories(newDirectories);
  }, [directories, saveDirectories]);

  // 删除目录
  const handleDeleteDirectory = useCallback((directoryId: string) => {
    if (directoryId === 'default') {
      message.warning('默认分组无法删除');
      return;
    }
    const newDirectories = directories.filter(dir => dir.id !== directoryId);
    saveDirectories(newDirectories);
    message.success('目录删除成功');
  }, [directories, saveDirectories]);

  return {
    directories,
    setDirectories,
    loadDirectories,
    saveDirectories,
    handleDirectoryToggle,
    handleDeleteDirectory,
  };
};
