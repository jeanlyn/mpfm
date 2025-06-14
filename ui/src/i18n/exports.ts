// i18n 核心配置
export { default as i18n } from './index';

// Hooks
export { useI18n, useAppI18n } from './hooks/useI18n';

// Contexts
export { I18nProvider, useI18nContext } from './contexts/I18nContext';

// Components
export { default as LanguageSwitcher } from './components/LanguageSwitcher';
export { default as I18nDemo } from './components/I18nDemo';
export { default as SettingsPage } from './components/SettingsPage';

// Types
export interface I18nConfig {
  defaultLanguage: string;
  supportedLanguages: string[];
  fallbackLanguage: string;
  enableDebug: boolean;
}

export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'en', name: 'English', nativeName: 'English' },
];
