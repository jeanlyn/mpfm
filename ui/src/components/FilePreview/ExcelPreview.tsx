import React, { useState, useEffect } from 'react';
import { Alert, Table, Tabs, Spin } from 'antd';
import { read, utils, WorkBook } from 'xlsx';

interface ExcelPreviewProps {
  content: ArrayBuffer;
  fileName: string;
}

interface SheetData {
  name: string;
  data: any[][];
  columns: any[];
}

const ExcelPreview: React.FC<ExcelPreviewProps> = ({ content, fileName }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);

  useEffect(() => {
    parseExcelFile();
  }, [content]);

  const parseExcelFile = async () => {
    try {
      setLoading(true);
      
      // 读取Excel文件
      const workbook: WorkBook = read(content, { type: 'array' });
      const sheetNames = workbook.SheetNames;
      
      if (sheetNames.length === 0) {
        setError('Excel文件中没有工作表');
        return;
      }

      const parsedSheets: SheetData[] = [];

      sheetNames.forEach((sheetName, index) => {
        // 限制只解析前5个工作表，避免性能问题
        if (index >= 5) return;

        const worksheet = workbook.Sheets[sheetName];
        const jsonData = utils.sheet_to_json(worksheet, { 
          header: 1, 
          defval: '', 
          raw: false 
        }) as any[][];

        if (jsonData.length === 0) {
          parsedSheets.push({
            name: sheetName,
            data: [],
            columns: []
          });
          return;
        }

        // 限制显示行数，避免性能问题
        const maxRows = 1000;
        const limitedData = jsonData.slice(0, maxRows);

        // 生成列定义
        const maxCols = Math.max(...limitedData.map(row => row.length));
        const columns = Array.from({ length: maxCols }, (_, index) => ({
          title: limitedData[0] && limitedData[0][index] ? String(limitedData[0][index]) : `列${index + 1}`,
          dataIndex: index,
          key: index,
          width: 150,
          ellipsis: true,
          render: (text: any) => String(text || ''),
        }));

        // 转换数据格式为antd Table需要的格式
        const tableData = limitedData.slice(1).map((row, rowIndex) => {
          const rowData: any = { key: rowIndex };
          row.forEach((cell, cellIndex) => {
            rowData[cellIndex] = cell;
          });
          return rowData;
        });

        parsedSheets.push({
          name: sheetName,
          data: tableData,
          columns: columns
        });
      });

      setSheets(parsedSheets);
      setLoading(false);
    } catch (err) {
      setError(`解析Excel文件失败: ${err}`);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>解析Excel文件中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Excel预览失败"
        description={error}
        type="error"
        showIcon
        style={{ margin: '20px' }}
      />
    );
  }

  if (sheets.length === 0) {
    return (
      <Alert
        message="Excel文件为空"
        description="文件中没有可显示的数据"
        type="warning"
        showIcon
        style={{ margin: '20px' }}
      />
    );
  }

  const tabItems = sheets.map(sheet => ({
    key: sheet.name,
    label: sheet.name,
    children: (
      <div style={{ padding: '16px' }}>
        {sheet.data.length > 0 ? (
          <>
            <div style={{ 
              marginBottom: '16px', 
              fontSize: '12px', 
              color: '#666' 
            }}>
              显示 {sheet.data.length} 行数据 × {sheet.columns.length} 列
              {sheet.data.length >= 999 && ' (仅显示前1000行)'}
            </div>
            <Table
              columns={sheet.columns}
              dataSource={sheet.data}
              size="small"
              scroll={{ x: 'max-content', y: 400 }}
              pagination={{
                pageSize: 50,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `第 ${range[0]}-${range[1]} 行，共 ${total} 行`,
              }}
            />
          </>
        ) : (
          <Alert
            message="工作表为空"
            description={`工作表 "${sheet.name}" 中没有数据`}
            type="info"
            showIcon
          />
        )}
      </div>
    )
  }));

  return (
    <div style={{ height: '100%' }}>
      {sheets.length === 1 ? (
        // 只有一个工作表时直接显示内容
        tabItems[0].children
      ) : (
        // 多个工作表时使用Tab切换
        <Tabs
          items={tabItems}
          style={{ height: '100%' }}
          tabBarStyle={{ marginBottom: 0 }}
        />
      )}
    </div>
  );
};

export default ExcelPreview;