import { useEffect } from 'react';

/**
 * 检测是否在 Tauri 环境中
 */
const isTauriEnvironment = (): boolean => {
  // Tauri v2 检测方式
  return typeof window !== 'undefined' && 
         (typeof (window as any).__TAURI_INTERNALS__ !== 'undefined' || 
          typeof (window as any).__TAURI__ !== 'undefined');
};

/**
 * 用于动态设置窗口标题的 Hook
 * @param title 要设置的标题
 */
export const useWindowTitle = (title: string) => {
  useEffect(() => {
    const updateTitle = async () => {
      console.log('Updating window title to:', title);
      
      if (isTauriEnvironment()) {
        try {
          // 在 Tauri 环境中，使用 Tauri API 设置窗口标题
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const currentWindow = getCurrentWindow();
          await currentWindow.setTitle(title);
          console.log('Successfully set Tauri window title to:', title);
        } catch (error) {
          console.warn('Failed to set window title via Tauri API:', error);
          // 回退到设置 document.title
          document.title = title;
          console.log('Fallback: set document.title to:', title);
        }
      } else {
        // 在浏览器环境中，设置 document.title
        document.title = title;
        console.log('Set document.title to:', title);
      }
    };

    updateTitle();
  }, [title]);
};
