import React, { useState, useEffect } from 'react';
import { Alert, Table, Tabs, Spin } from 'antd';
import { read, utils, WorkBook } from 'xlsx';
import { useAppI18n } from '../../i18n/hooks/useI18n';

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
  const { filePreview } = useAppI18n();

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
        setError(filePreview.excelNoSheets);
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
          title: limitedData[0] && limitedData[0][index] ? String(limitedData[0][index]) : `${filePreview.excelColumnPrefix}${index + 1}`,
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
      setError(`${filePreview.excelParseError}: ${err}`);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>{filePreview.loading}</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message={filePreview.excelPreviewFailed}
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
        message={filePreview.excelFileEmpty}
        description={filePreview.excelFileEmptyDescription}
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
              {filePreview.excelDisplayRows
                .replace('{rows}', sheet.data.length.toString())
                .replace('{cols}', sheet.columns.length.toString())}
              {sheet.data.length >= 999 && filePreview.excelLimitedRows}
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
                  filePreview.excelPaginationTotal
                    .replace('{start}', range[0].toString())
                    .replace('{end}', range[1].toString())
                    .replace('{total}', total.toString()),
              }}
            />
          </>
        ) : (
          <Alert
            message={filePreview.excelWorksheetEmpty}
            description={filePreview.excelWorksheetEmptyDescription.replace('{sheetName}', sheet.name)}
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