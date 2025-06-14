# 国际化 (i18n) 使用指南

本项目使用 `react-i18next` 来实现国际化支持。

## 项目结构

```
src/
├── i18n/
│   ├── index.ts              # i18n 配置文件
│   ├── exports.ts            # 统一导出文件
│   ├── README.md             # 使用指南
│   ├── locales/
│   │   ├── zh/
│   │   │   └── translation.json  # 中文翻译
│   │   └── en/
│   │       └── translation.json  # 英文翻译
│   ├── hooks/
│   │   └── useI18n.ts        # i18n 自定义 hooks
│   ├── contexts/
│   │   └── I18nContext.tsx   # i18n 上下文提供者
│   └── components/
│       ├── LanguageSwitcher.tsx  # 语言切换组件
│       ├── I18nDemo.tsx          # i18n 演示组件
│       └── SettingsPage.tsx      # 设置页面
└── ...
```

## 快速开始

### 1. 基本使用

使用 `useTranslation` hook：

```tsx
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('app.title')}</h1>
      <button>{t('app.save')}</button>
    </div>
  );
};
```

### 2. 使用自定义 Hook

使用 `useAppI18n` hook 获得类型化的翻译文本：

```tsx
import { useAppI18n } from '../i18n/hooks/useI18n';

const MyComponent = () => {
  const { app, connection } = useAppI18n();
  
  return (
    <div>
      <h1>{app.title}</h1>
      <button>{connection.connect}</button>
    </div>
  );
};
```

### 3. 语言切换

使用 `LanguageSwitcher` 组件：

```tsx
import LanguageSwitcher from '../i18n/components/LanguageSwitcher';

const Header = () => {
  return (
    <div>
      <LanguageSwitcher size="small" />
    </div>
  );
};
```

### 4. 使用上下文

使用 `useI18nContext` 进行更复杂的语言管理：

```tsx
import { useI18nContext } from '../i18n/contexts/I18nContext';

const MyComponent = () => {
  const { currentLanguage, changeLanguage, isLoading } = useI18nContext();
  
  return (
    <div>
      <p>当前语言: {currentLanguage}</p>
      <button onClick={() => changeLanguage('en')}>
        切换到英文
      </button>
    </div>
  );
};
```

## 添加新的翻译

### 1. 修改翻译文件

在 `src/i18n/locales/zh/translation.json` 和 `src/i18n/locales/en/translation.json` 中添加新的键值对：

```json
{
  "myModule": {
    "title": "我的模块",
    "buttons": {
      "submit": "提交",
      "cancel": "取消"
    }
  }
}
```

### 2. 更新类型化 Hook

在 `src/i18n/hooks/useI18n.ts` 中的 `useAppI18n` 函数中添加新的翻译：

```tsx
export const useAppI18n = () => {
  const { t } = useTranslation();

  return {
    // ...existing translations...
    myModule: {
      title: t('myModule.title'),
      buttons: {
        submit: t('myModule.buttons.submit'),
        cancel: t('myModule.buttons.cancel'),
      },
    },
  };
};
```

## 支持的语言

目前支持以下语言：

- 中文 (zh)
- 英文 (en)

## 特性

- ✅ 自动语言检测
- ✅ 本地存储语言设置
- ✅ 类型安全的翻译文本
- ✅ 语言切换组件
- ✅ 上下文管理
- ✅ 开发时调试支持

## 配置选项

在 `src/i18n/index.ts` 中可以修改以下配置：

- `fallbackLng`: 默认语言
- `debug`: 是否启用调试模式
- `detection.order`: 语言检测顺序
- `detection.caches`: 语言缓存方式

## 最佳实践

1. **使用嵌套键值**: 将相关的翻译文本组织在一起
2. **保持键名一致**: 确保所有语言文件中的键名结构相同
3. **使用描述性键名**: 键名应该清楚地描述内容的用途
4. **类型化翻译**: 使用 `useAppI18n` hook 获得更好的开发体验
5. **测试多语言**: 确保在所有支持的语言下界面都正常工作

## 故障排除

### 1. 翻译文本没有显示

- 检查键名是否正确
- 确保翻译文件格式正确
- 检查 i18n 是否正确初始化

### 2. 语言切换不生效

- 检查 `I18nProvider` 是否正确包装了应用
- 确保本地存储权限正常
- 检查浏览器控制台是否有错误

### 3. 类型错误

- 确保 `useAppI18n` hook 中的翻译键与翻译文件匹配
- 检查 TypeScript 配置是否正确
