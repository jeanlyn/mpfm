import { Connection } from '../../types';

export const MODAL_TYPES = {
  ADD: 'add',
  COPY: 'copy',
  EDIT: 'edit'
} as const;

export type ModalType = typeof MODAL_TYPES[keyof typeof MODAL_TYPES];

export interface ModalConfig {
  isOpen: boolean;
  type: ModalType;
  connection?: Connection | null;
}

export interface ConnectionManagerProps {
  connections: Connection[];
  currentConnection: Connection | null;
  onConnectionSelect: (connection: Connection) => void;
  onConnectionsChange: () => void;
}

export interface DirectoryItem {
  id: string;
  name: string;
  connectionIds: string[];
  expanded?: boolean;
}

export interface DraggableConnectionProps {
  connection: Connection;
  directoryId: string;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

export interface DroppableDirectoryProps {
  directory: DirectoryItem;
  children: React.ReactNode;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}
