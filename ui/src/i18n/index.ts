import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 导入语言资源
import zhTranslations from './locales/zh/translation.json';
import enTranslations from './locales/en/translation.json';

const resources = {
  zh: {
    translation: zhTranslations,
  },
  en: {
    translation: enTranslations,
  },
};

i18n
  .use(LanguageDetector) // 检测浏览器语言
  .use(initReactI18next) // 绑定 react-i18next
  .init({
    resources,
    fallbackLng: 'zh', // 默认语言
    debug: process.env.NODE_ENV === 'development',
    
    // 语言检测配置
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false, // React 已经默认转义
    },

    // 命名空间配置
    defaultNS: 'translation',
    ns: ['translation'],
  });

export default i18n;
