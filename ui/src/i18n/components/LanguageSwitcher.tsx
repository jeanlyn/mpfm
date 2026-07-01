import React from 'react';
import { Select } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useI18nContext } from '../contexts/I18nContext';

const { Option } = Select;

interface LanguageSwitcherProps {
  className?: string;
  size?: 'small' | 'middle' | 'large';
  style?: React.CSSProperties;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  className,
  size = 'middle',
  style,
}) => {
  const { currentLanguage, availableLanguages, changeLanguage, isLoading } = useI18nContext();

  const handleLanguageChange = (value: string) => {
    changeLanguage(value);
  };

  return (
    <Select
      value={currentLanguage}
      onChange={handleLanguageChange}
      size={size}
      className={className}
      style={{ minWidth: 120, ...style }}
      suffixIcon={<GlobalOutlined />}
      loading={isLoading}
    >
      {availableLanguages.map((lang) => (
        <Option key={lang.code} value={lang.code}>
          {lang.nativeName}
        </Option>
      ))}
    </Select>
  );
};

export default LanguageSwitcher;
