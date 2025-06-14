import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useAppI18n } from './useI18n';

/**
 * 检测是否在 Tauri 环境中
 */
const isTauriEnvironment = (): boolean => {
    const hasTauri = typeof window !== 'undefined' && 
         (typeof (window as any).__TAURI_INTERNALS__ !== 'undefined' || 
          typeof (window as any).__TAURI__ !== 'undefined');
    
    console.log('Tauri environment check:', {
        hasWindow: typeof window !== 'undefined',
        hasTauriInternals: typeof (window as any).__TAURI_INTERNALS__ !== 'undefined',
        hasTauri: typeof (window as any).__TAURI__ !== 'undefined',
        result: hasTauri
    });
    
    return hasTauri;
};

/**
 * 自定义 Hook 用于动态更新窗口标题
 * 根据当前语言设置自动更新 Tauri 窗口标题
 */
export const useWindowTitle = () => {
  const { app } = useAppI18n();

  useEffect(() => {
    const updateTitle = async () => {
      try {
        // 检查是否在 Tauri 环境中
        if (isTauriEnvironment()) {
          const appWindow = getCurrentWindow();
          await appWindow.setTitle(app.title);
          console.log('Window title updated to:', app.title);
        } else {
          console.log('Not in Tauri environment, title would be:', app.title);
        }
      } catch (error) {
        console.error('Failed to update window title:', error);
      }
    };

    updateTitle();
  }, [app.title]); // 当标题翻译改变时重新执行

  return {
    updateTitle: async (title?: string) => {
      try {
        if (isTauriEnvironment()) {
          const appWindow = getCurrentWindow();
          const titleToSet = title || app.title;
          await appWindow.setTitle(titleToSet);
          console.log('Window title manually updated to:', titleToSet);
        } else {
          console.log('Not in Tauri environment, manual title would be:', title || app.title);
        }
      } catch (error) {
        console.error('Failed to manually update window title:', error);
      }
    }
  };
};
