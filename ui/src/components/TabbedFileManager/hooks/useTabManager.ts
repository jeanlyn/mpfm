import { useState, useCallback } from 'react';
import { Connection } from '../../../types';

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

export const useTabManager = () => {
  const [state, setState] = useState<TabManagerState>({
    tabs: [],
    activeTabId: null,
  });

  // 创建新Tab
  const createTab = useCallback((connection: Connection): FileManagerTab => {
    return {
      id: connection.id,
      connection,
      title: `${connection.name} (${connection.protocol_type.toUpperCase()})`,
      active: true,
    };
  }, []);

  // 打开Tab（如果已存在则激活，否则创建新的）
  const openTab = useCallback((connection: Connection) => {
    setState(prevState => {
      const existingTabIndex = prevState.tabs.findIndex(tab => tab.id === connection.id);
      
      if (existingTabIndex !== -1) {
        // Tab已存在，激活它
        const updatedTabs = prevState.tabs.map((tab, index) => ({
          ...tab,
          active: index === existingTabIndex,
        }));
        
        return {
          tabs: updatedTabs,
          activeTabId: connection.id,
        };
      } else {
        // 创建新Tab
        const newTab = createTab(connection);
        const updatedTabs = [
          ...prevState.tabs.map(tab => ({ ...tab, active: false })),
          newTab,
        ];
        
        return {
          tabs: updatedTabs,
          activeTabId: connection.id,
        };
      }
    });
  }, [createTab]);

  // 关闭Tab
  const closeTab = useCallback((tabId: string) => {
    setState(prevState => {
      const updatedTabs = prevState.tabs.filter(tab => tab.id !== tabId);
      let newActiveTabId = prevState.activeTabId;
      
      // 如果关闭的是当前活跃的Tab
      if (prevState.activeTabId === tabId) {
        if (updatedTabs.length > 0) {
          // 激活最后一个Tab
          const lastTab = updatedTabs[updatedTabs.length - 1];
          newActiveTabId = lastTab.id;
          updatedTabs[updatedTabs.length - 1] = { ...lastTab, active: true };
        } else {
          newActiveTabId = null;
        }
      }
      
      return {
        tabs: updatedTabs,
        activeTabId: newActiveTabId,
      };
    });
  }, []);

  // 切换到指定Tab
  const switchToTab = useCallback((tabId: string) => {
    setState(prevState => {
      const updatedTabs = prevState.tabs.map(tab => ({
        ...tab,
        active: tab.id === tabId,
      }));
      
      return {
        tabs: updatedTabs,
        activeTabId: tabId,
      };
    });
  }, []);

  // 关闭所有Tab
  const closeAllTabs = useCallback(() => {
    setState({
      tabs: [],
      activeTabId: null,
    });
  }, []);

  // 关闭其他Tab
  const closeOtherTabs = useCallback((keepTabId: string) => {
    setState(prevState => {
      const keepTab = prevState.tabs.find(tab => tab.id === keepTabId);
      if (!keepTab) return prevState;
      
      return {
        tabs: [{ ...keepTab, active: true }],
        activeTabId: keepTabId,
      };
    });
  }, []);

  // 获取当前活跃的Tab
  const getActiveTab = useCallback(() => {
    return state.tabs.find(tab => tab.active) || null;
  }, [state.tabs]);

  // 检查Tab是否已打开
  const isTabOpen = useCallback((connectionId: string) => {
    return state.tabs.some(tab => tab.id === connectionId);
  }, [state.tabs]);

  return {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    openTab,
    closeTab,
    switchToTab,
    closeAllTabs,
    closeOtherTabs,
    getActiveTab,
    isTabOpen,
  };
};
