import React, { useCallback, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { message } from 'antd';
import { FileOutlined, FolderOutlined, DragOutlined } from '@ant-design/icons';
import { Connection, FileInfo } from '../types';
import {
  DND_TYPES,
  RemoteFileDragData,
  ConnectionSortDragData,
  getConnectionDndBridge,
  parseConnectionDropId,
  parseTabDropId,
} from '../dnd/types';
import { useAppI18n } from '../i18n/hooks/useI18n';
import { getConnectionIcon } from '../components/ConnectionManager/utils.tsx';

interface AppDndProviderProps {
  children: React.ReactNode;
  connections: Connection[];
  onRemoteFileDrop: (
    sourceConnectionId: string,
    files: FileInfo[],
    targetConnection: Connection
  ) => void;
  onOpenTab?: (connection: Connection) => void;
}

export const AppDndProvider: React.FC<AppDndProviderProps> = ({
  children,
  connections,
  onRemoteFileDrop,
  onOpenTab,
}) => {
  const { directory, fileManager } = useAppI18n();
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null);
  const [activeFiles, setActiveFiles] = useState<FileInfo[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: { opacity: '0.5' },
      },
    }),
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;

    if (data?.type === DND_TYPES.CONNECTION_SORT) {
      const sortData = data as ConnectionSortDragData;
      setActiveConnection(sortData.connection);
      setActiveFiles([]);
      return;
    }

    if (data?.type === DND_TYPES.REMOTE_FILE) {
      const fileData = data as RemoteFileDragData;
      setActiveConnection(null);
      setActiveFiles(fileData.files);
    }
  }, []);

  const handleConnectionSortEnd = useCallback(
    (activeId: string, overId: string) => {
      const bridge = getConnectionDndBridge();
      if (!bridge) return;

      const { connections: bridgeConnections, directories, saveDirectories } = bridge;

      if (!overId.startsWith('dir-')) return;

      const directoryId = overId.replace('dir-', '');
      const connectionId = activeId;
      const connection = bridgeConnections.find((conn) => conn.id === connectionId);
      const targetDirectory = directories.find((dir) => dir.id === directoryId);

      if (!connection || !targetDirectory) return;

      if (targetDirectory.connectionIds.includes(connectionId)) {
        const msg = directory.connectionAlreadyInDirectoryDetailed
          .replace('{connectionName}', connection.name)
          .replace('{directoryName}', targetDirectory.name);
        message.info(msg);
        return;
      }

      const newDirectories = directories.map((dir) => {
        if (dir.id === directoryId) {
          return {
            ...dir,
            connectionIds: [...dir.connectionIds, connectionId],
          };
        }
        if (dir.id !== 'default') {
          return {
            ...dir,
            connectionIds: dir.connectionIds.filter((id) => id !== connectionId),
          };
        }
        return dir;
      });

      saveDirectories(newDirectories);
      message.success(
        directory.connectionAddedToDirectory
          .replace('{connectionName}', connection.name)
          .replace('{directoryName}', targetDirectory.name)
      );
    },
    [directory]
  );

  const resolveTargetConnection = useCallback(
    (overId: string): Connection | null => {
      const connFromSidebar = parseConnectionDropId(overId);
      const connFromTab = parseTabDropId(overId);
      const targetId = connFromSidebar ?? connFromTab;
      if (!targetId) return null;
      return connections.find((c) => c.id === targetId) ?? null;
    },
    [connections]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const activeData = active.data.current;

      setActiveConnection(null);
      setActiveFiles([]);

      if (!over || !activeData) return;

      if (activeData.type === DND_TYPES.REMOTE_FILE) {
        const fileData = activeData as RemoteFileDragData;
        const targetConnection = resolveTargetConnection(over.id as string);
        if (!targetConnection) return;

        onOpenTab?.(targetConnection);
        onRemoteFileDrop(fileData.connectionId, fileData.files, targetConnection);
        return;
      }

      if (activeData.type === DND_TYPES.CONNECTION_SORT) {
        handleConnectionSortEnd(active.id as string, over.id as string);
      }
    },
    [handleConnectionSortEnd, onOpenTab, onRemoteFileDrop, resolveTargetConnection]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay dropAnimation={dropAnimation}>
        {activeConnection ? (
          <div className="dnd-overlay dnd-overlay--connection">
            {getConnectionIcon(activeConnection.protocol_type)}
            <span>{activeConnection.name}</span>
            <DragOutlined className="dnd-overlay__handle" />
          </div>
        ) : activeFiles.length > 0 ? (
          <div className="dnd-overlay dnd-overlay--file">
            {activeFiles[0].is_dir ? (
              <FolderOutlined className="dnd-overlay__icon" />
            ) : (
              <FileOutlined className="dnd-overlay__icon" />
            )}
            <span>
              {activeFiles.length === 1
                ? activeFiles[0].name
                : fileManager.messages.itemsCount.replace('{count}', String(activeFiles.length))}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
