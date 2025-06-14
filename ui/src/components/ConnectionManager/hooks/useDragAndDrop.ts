import { useState, useCallback } from 'react';
import { message } from 'antd';
import { useSensors, useSensor, PointerSensor, KeyboardSensor } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core';
import { Connection } from '../../../types';
import { DirectoryItem } from '../types';
import { useAppI18n } from '../../../i18n/hooks/useI18n';

/**
 * 拖拽功能Hook
 */
export const useDragAndDrop = (
  connections: Connection[],
  directories: DirectoryItem[],
  saveDirectories: (dirs: DirectoryItem[]) => void
) => {
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const { directory } = useAppI18n();

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 拖拽开始
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const connectionId = active.id as string;
    const connection = connections.find(conn => conn.id === connectionId);
    
    if (connection) {
      setActiveConnection(connection);
    }
  }, [connections]);

  // 拖拽悬停
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    // 如果拖拽到目录上
    if (overId.startsWith('dir-')) {
      const directoryId = overId.replace('dir-', '');
      const activeConnectionId = activeId;
      
      // 检查连接是否已经在目标目录中
      const targetDirectory = directories.find(dir => dir.id === directoryId);
      if (targetDirectory && !targetDirectory.connectionIds.includes(activeConnectionId)) {
        // 临时视觉反馈（可以添加样式变化）
        console.log(`准备将连接 ${activeConnectionId} 移动到目录 ${directoryId}`);
      }
    }
  }, [directories]);

  // 拖拽结束
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveConnection(null);
    
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    // 如果拖拽到目录上
    if (overId.startsWith('dir-')) {
      const directoryId = overId.replace('dir-', '');
      const connectionId = activeId;
      
      // 找到连接和目标目录
      const connection = connections.find(conn => conn.id === connectionId);
      const targetDirectory = directories.find(dir => dir.id === directoryId);
      
      if (!connection || !targetDirectory) return;
      
      // 检查连接是否已经在目标目录
      if (targetDirectory.connectionIds.includes(connectionId)) {
        const msg = directory.connectionAlreadyInDirectoryDetailed
          .replace('{connectionName}', connection.name)
          .replace('{directoryName}', targetDirectory.name);
        message.info(msg);
        return;
      }
      
      // 更新目录配置
      const newDirectories = directories.map(dir => {
        if (dir.id === directoryId) {
          // 添加到目标目录
          return {
            ...dir,
            connectionIds: [...dir.connectionIds, connectionId]
          };
        } else if (dir.id !== 'default') {
          // 从其他非默认目录中移除
          return {
            ...dir,
            connectionIds: dir.connectionIds.filter(id => id !== connectionId)
          };
        }
        // 默认目录保持不变，不移除任何连接
        return dir;
      });
      
      saveDirectories(newDirectories);
      message.success(directory.connectionAddedToDirectory
        .replace('{connectionName}', connection.name)
        .replace('{directoryName}', targetDirectory.name));
    }
  }, [connections, directories, saveDirectories]);

  return {
    activeConnection,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
};
