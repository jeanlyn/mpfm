import { useEffect } from 'react';
import { calculateTableHeight } from '../utils';
import { RESERVED_HEIGHT, MIN_TABLE_HEIGHT, MAX_TABLE_HEIGHT } from '../constants';

/**
 * 表格高度动态计算 Hook
 */
export const useTableHeight = (onHeightChange: (height: number) => void) => {
  useEffect(() => {
    const handleHeightCalculation = () => {
      const height = calculateTableHeight(RESERVED_HEIGHT, MIN_TABLE_HEIGHT, MAX_TABLE_HEIGHT);
      onHeightChange(height);
    };

    // 初始计算
    handleHeightCalculation();
    
    // 监听窗口大小变化
    window.addEventListener('resize', handleHeightCalculation);
    
    // 清理事件监听器
    return () => {
      window.removeEventListener('resize', handleHeightCalculation);
    };
  }, [onHeightChange]);
};
