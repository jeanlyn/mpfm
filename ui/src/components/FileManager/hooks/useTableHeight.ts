import { useEffect, type RefObject, type DependencyList } from 'react';
import { MIN_TABLE_HEIGHT } from '../constants';

/** Ant Design small Table 表头高度（首次渲染 thead 尚未挂载时的回退值） */
const TABLE_HEADER_HEIGHT_FALLBACK = 39;

/**
 * 根据表格容器实际高度动态计算 scroll.y，使表格填满 flex 剩余区域，避免底部空白。
 */
export const useTableHeight = (
  containerRef: RefObject<HTMLElement | null>,
  onHeightChange: (height: number) => void,
  remeasureDeps: DependencyList = []
) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateHeight = () => {
      const containerHeight = container.clientHeight;
      if (containerHeight <= 0) return;

      const header = container.querySelector('.ant-table-thead');
      const headerHeight =
        header?.getBoundingClientRect().height ?? TABLE_HEADER_HEIGHT_FALLBACK;
      const scrollHeight = Math.floor(containerHeight - headerHeight);

      if (scrollHeight >= MIN_TABLE_HEIGHT) {
        onHeightChange(scrollHeight);
      }
    };

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(updateHeight);
    });
    observer.observe(container);

    updateHeight();
    const timer = window.setTimeout(updateHeight, 0);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, onHeightChange, ...remeasureDeps]);
};
