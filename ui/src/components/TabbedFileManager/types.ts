import { Connection } from '../../types';

export interface FileManagerTab {
  id: string;
  connection: Connection;
  title: string;
  active: boolean;
}

export interface TabManagerState {
  tabs: FileManagerTab[];
  activeTabId: string | null;
}

export interface TabbedFileManagerProps {
  selectedConnection: Connection | null;
}

export interface TabBarProps {
  tabs: FileManagerTab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onCloseAll: () => void;
  onCloseOthers: (tabId: string) => void;
}

export interface FileManagerTabProps {
  connection: Connection;
  visible: boolean;
}
