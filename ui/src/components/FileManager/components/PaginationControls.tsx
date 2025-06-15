import React from 'react';
import { Pagination, Select, Space } from 'antd';
import { useAppI18n } from '../../../i18n/hooks/useI18n';
import { PAGE_SIZES } from '../constants';

const { Option } = Select;

interface PaginationControlsProps {
  loadingMode: 'pagination' | 'all';
  totalFiles: number;
  isSearchMode: boolean;
  searchTotal: number;
  currentPage: number;
  searchPage: number;
  pageSize: number;
  onPageChange: (page: number, size?: number) => void;
  onSearchPageChange: (page: number, size?: number) => void;
  onPageSizeChange: (value: number) => void;
}

/**
 * 分页控件组件
 */
const PaginationControls: React.FC<PaginationControlsProps> = ({
  loadingMode,
  totalFiles,
  isSearchMode,
  searchTotal,
  currentPage,
  searchPage,
  pageSize,
  onPageChange,
  onSearchPageChange,
  onPageSizeChange,
}) => {
  const { fileManager } = useAppI18n();

  // 判断是否需要显示分页
  const shouldShowPagination = (loadingMode === 'pagination' && totalFiles > 0) || (isSearchMode && searchTotal > 0);

  if (!shouldShowPagination) {
    return null;
  }

  return (
    <div style={{ 
      marginTop: '5px', 
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '8px',
      flexShrink: 0,
      borderTop: '1px solid #f0f0f0',
      paddingTop: '8px',
      minHeight: '48px'
    }}>
      {/* 左侧：每页显示数量选择 */}
      <Space size="small">
        <span>{fileManager.pagination.showPerPage}</span>
        <Select
          value={pageSize}
          onChange={onPageSizeChange}
          style={{ width: 70 }}
          size="small"
        >
          {PAGE_SIZES.map(size => (
            <Option key={size} value={size}>{size}</Option>
          ))}
        </Select>
        <span>{fileManager.pagination.items}</span>
      </Space>

      {/* 右侧：分页控件 */}
      <Pagination
        current={isSearchMode ? searchPage + 1 : currentPage + 1}
        pageSize={pageSize}
        total={isSearchMode ? searchTotal : totalFiles}
        onChange={isSearchMode ? onSearchPageChange : onPageChange}
        showSizeChanger={false}
        showQuickJumper
        showTotal={(total, range) => 
          fileManager.pagination.pageInfo
            .replace('{start}', range[0].toString())
            .replace('{end}', range[1].toString())
            .replace('{total}', total.toString())
        }
        size="small"
      />
    </div>
  );
};

export default PaginationControls;
