import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Connection } from '../../../types';
import { DND_TYPES, tabDropId } from '../../../dnd/types';

interface DroppableTabLabelProps {
  connection: Connection;
  title: string;
  children: React.ReactNode;
}

export const DroppableTabLabel: React.FC<DroppableTabLabelProps> = ({
  connection,
  title,
  children,
}) => {
  const { setNodeRef, isOver, active } = useDroppable({
    id: tabDropId(connection.id),
    data: {
      type: DND_TYPES.TAB_DROP,
      connection,
    },
  });

  const isFileDropTarget =
    isOver && active?.data.current?.type === DND_TYPES.REMOTE_FILE;

  return (
    <div
      ref={setNodeRef}
      className={isFileDropTarget ? 'tab-drop-target' : undefined}
      title={title}
    >
      {children}
    </div>
  );
};
