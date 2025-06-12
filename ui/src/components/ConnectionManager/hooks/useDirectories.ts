import { useState, useCallback } from 'react';
import { message } from 'antd';
import { DirectoryItem } from '../types';
import { Connection } from '../../../types';
import { configService } from '../../../services/configService';

/**
 * 目录管理相关的Hook
 */
export const useDirectories = (connections: Connection[]) => {
  const [directories, setDirectories] = useState<DirectoryItem[]>([]);

  // 从配置服务加载目录配置
  const loadDirectories = useCallback(async () => {
    try {
      const saved = await configService.loadConfig<DirectoryItem[]>('directories');
      if (saved) {
        // 确保默认分组包含所有连接
        const updatedDirectories = saved.map((dir: DirectoryItem) => {
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
        await configService.saveConfig('directories', defaultDirectories);
      }
    } catch (error) {
      console.error('加载目录配置失败:', error);
      message.error('加载目录配置失败');
      setDirectories([]);
    }
  }, [connections]);

  // 保存目录配置到配置服务
  const saveDirectories = useCallback(async (dirs: DirectoryItem[]) => {
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
      
      await configService.saveConfig('directories', updatedDirs);
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

  // 导出目录配置
  const exportDirectories = useCallback(async () => {
    try {
      const config = {
        directories,
        exportTime: new Date().toISOString(),
        version: '1.0'
      };
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mpfm-directories-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('目录配置导出成功');
    } catch (error) {
      console.error('导出配置失败:', error);
      message.error('导出配置失败');
    }
  }, [directories]);

  // 导入目录配置
  const importDirectories = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const config = JSON.parse(content);
        if (config.directories && Array.isArray(config.directories)) {
          await saveDirectories(config.directories);
          message.success('目录配置导入成功');
        } else {
          message.error('配置文件格式错误');
        }
      } catch (error) {
        console.error('导入配置失败:', error);
        message.error('导入配置失败');
      }
    };
    reader.readAsText(file);
  }, [saveDirectories]);

  return {
    directories,
    setDirectories,
    loadDirectories,
    saveDirectories,
    handleDirectoryToggle,
    handleDeleteDirectory,
    exportDirectories,
    importDirectories,
  };
};
