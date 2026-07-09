import { Connection, FileInfo } from '../types';
import { DirectoryItem } from '../components/ConnectionManager/types';

export const DND_TYPES = {
  CONNECTION_SORT: 'connection-sort',
  REMOTE_FILE: 'remote-file',
  CONNECTION_DROP: 'connection-drop',
  TAB_DROP: 'tab-drop',
} as const;

export type DndType = (typeof DND_TYPES)[keyof typeof DND_TYPES];

export interface ConnectionSortDragData {
  type: typeof DND_TYPES.CONNECTION_SORT;
  connection: Connection;
  directoryId: string;
}

export interface RemoteFileDragData {
  type: typeof DND_TYPES.REMOTE_FILE;
  connectionId: string;
  files: FileInfo[];
}

export interface ConnectionDropData {
  type: typeof DND_TYPES.CONNECTION_DROP;
  connection: Connection;
}

export interface TabDropData {
  type: typeof DND_TYPES.TAB_DROP;
  connection: Connection;
}

export interface ConnectionDndBridge {
  connections: Connection[];
  directories: DirectoryItem[];
  saveDirectories: (dirs: DirectoryItem[]) => void;
}

let connectionDndBridge: ConnectionDndBridge | null = null;

export function registerConnectionDndBridge(bridge: ConnectionDndBridge | null) {
  connectionDndBridge = bridge;
}

export function getConnectionDndBridge(): ConnectionDndBridge | null {
  return connectionDndBridge;
}

export function connectionDropId(connectionId: string) {
  return `drop-conn-${connectionId}`;
}

export function tabDropId(connectionId: string) {
  return `drop-tab-${connectionId}`;
}

export function remoteFileDragId(connectionId: string, path: string) {
  return `file-${connectionId}-${path}`;
}

export function parseConnectionDropId(id: string): string | null {
  if (!id.startsWith('drop-conn-')) return null;
  return id.slice('drop-conn-'.length);
}

export function parseTabDropId(id: string): string | null {
  if (!id.startsWith('drop-tab-')) return null;
  return id.slice('drop-tab-'.length);
}
