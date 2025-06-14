import { useTranslation } from 'react-i18next';

// 通用的 i18n hook
export const useI18n = () => {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const getCurrentLanguage = () => {
    return i18n.language;
  };

  const getAvailableLanguages = () => {
    return Object.keys(i18n.options.resources || {});
  };

  return {
    t,
    changeLanguage,
    getCurrentLanguage,
    getAvailableLanguages,
    i18n,
  };
};

// 应用相关的 i18n hook
export const useAppI18n = () => {
  const { t } = useTranslation();

  return {
    // 应用通用文本
    app: {
      title: t('app.title'),
      loading: t('app.loading'),
      error: t('app.error'),
      success: t('app.success'),
      confirm: t('app.confirm'),
      cancel: t('app.cancel'),
      save: t('app.save'),
      delete: t('app.delete'),
      edit: t('app.edit'),
      create: t('app.create'),
      close: t('app.close'),
      refresh: t('app.refresh'),
    },
    // 连接管理相关文本
    connection: {
      title: t('connection.title'),
      add: t('connection.add'),
      edit: t('connection.edit'),
      delete: t('connection.delete'),
      connect: t('connection.connect'),
      disconnect: t('connection.disconnect'),
      test: t('connection.test'),
      name: t('connection.name'),
      type: t('connection.type'),
      host: t('connection.host'),
      port: t('connection.port'),
      username: t('connection.username'),
      password: t('connection.password'),
      status: {
        connected: t('connection.status.connected'),
        disconnected: t('connection.status.disconnected'),
        connecting: t('connection.status.connecting'),
        error: t('connection.status.error'),
      },
      messages: {
        loadFailed: t('connection.messages.loadFailed'),
        connectSuccess: t('connection.messages.connectSuccess'),
        connectFailed: t('connection.messages.connectFailed'),
        disconnectSuccess: t('connection.messages.disconnectSuccess'),
        testSuccess: t('connection.messages.testSuccess'),
        testFailed: t('connection.messages.testFailed'),
        saveSuccess: t('connection.messages.saveSuccess'),
        deleteFailed: t('connection.messages.deleteFailed'),
      },
    },
    // 文件管理器相关文本
    fileManager: {
      title: t('fileManager.title'),
      path: t('fileManager.path'),
      name: t('fileManager.name'),
      size: t('fileManager.size'),
      modified: t('fileManager.modified'),
      type: t('fileManager.type'),
      actions: {
        upload: t('fileManager.actions.upload'),
        download: t('fileManager.actions.download'),
        newFolder: t('fileManager.actions.newFolder'),
        rename: t('fileManager.actions.rename'),
        copy: t('fileManager.actions.copy'),
        move: t('fileManager.actions.move'),
        properties: t('fileManager.actions.properties'),
      },
      messages: {
        uploadSuccess: t('fileManager.messages.uploadSuccess'),
        uploadFailed: t('fileManager.messages.uploadFailed'),
        downloadSuccess: t('fileManager.messages.downloadSuccess'),
        downloadFailed: t('fileManager.messages.downloadFailed'),
        deleteSuccess: t('fileManager.messages.deleteSuccess'),
        deleteFailed: t('fileManager.messages.deleteFailed'),
        renameSuccess: t('fileManager.messages.renameSuccess'),
        renameFailed: t('fileManager.messages.renameFailed'),
        copySuccess: t('fileManager.messages.copySuccess'),
        copyFailed: t('fileManager.messages.copyFailed'),
        moveSuccess: t('fileManager.messages.moveSuccess'),
        moveFailed: t('fileManager.messages.moveFailed'),
      },
    },
    // 设置相关文本
    settings: {
      title: t('settings.title'),
      language: t('settings.language'),
      theme: t('settings.theme'),
      general: t('settings.general'),
      appearance: t('settings.appearance'),
      advanced: t('settings.advanced'),
    },
  };
};
