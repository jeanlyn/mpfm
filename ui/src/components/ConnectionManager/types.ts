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
  onRefreshConnections: () => void;
}

export interface DirectoryItem {
  id: string;
  name: string;
  connectionIds: string[];
  expanded?: boolean;
}

export interface ConnectionItemProps {
  connection: Connection;
  directoryId: string;
  isActive: boolean;
  isS3: boolean;
  bucketExpanded: boolean;
  buckets: string[];
  bucketLoading: boolean;
  bucketLoadFailed: boolean;
  bucketSwitching: boolean;
  bucketCreating: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onShare: () => void;
  onDelete: () => void;
  onToggleBucket: () => void;
  onRefreshBuckets: () => void;
  onBucketSwitch: (bucket: string) => void | Promise<void>;
  onBucketCreate: (name: string) => void | Promise<void>;
}

export interface DroppableDirectoryProps {
  directory: DirectoryItem;
  children: React.ReactNode;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}
