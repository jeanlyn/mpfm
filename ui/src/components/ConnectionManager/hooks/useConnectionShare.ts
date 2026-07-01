import { useState, useCallback } from 'react';
import { Modal, message } from 'antd';
import { Connection } from '../../../types';
import { ApiService } from '../../../services/api';
import {
  serializeConnections,
  parseConnectionExport,
  resolveImportName,
  downloadConnectionExport,
  ConnectionExportItem,
} from '../utils/connectionExport';
import { useAppI18n } from '../../../i18n/hooks/useI18n';

export const useConnectionShare = (
  connections: Connection[],
  onConnectionsChange: () => void
) => {
  const { connection: i18n } = useAppI18n();
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareContent, setShareContent] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ConnectionExportItem[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const openShareModal = useCallback((toShare: Connection[]) => {
    if (toShare.length === 0) {
      message.warning(i18n.share.noConnectionsToExport);
      return;
    }

    Modal.confirm({
      title: i18n.share.securityWarningTitle,
      content: i18n.share.securityWarningContent,
      okText: i18n.share.securityWarningConfirm,
      cancelText: i18n.share.securityWarningCancel,
      onOk: () => {
        setShareContent(serializeConnections(toShare));
        setShareModalOpen(true);
      },
    });
  }, [i18n.share]);

  const closeShareModal = useCallback(() => {
    setShareModalOpen(false);
    setShareContent('');
  }, []);

  const handleShareConnection = useCallback((connection: Connection) => {
    openShareModal([connection]);
  }, [openShareModal]);

  const handleExportAll = useCallback(() => {
    openShareModal(connections);
  }, [connections, openShareModal]);

  const handleCopyShareContent = useCallback(async () => {
    try {
      await ApiService.copyTextToClipboard(shareContent);
      message.success(i18n.share.copySuccess);
    } catch {
      message.error(i18n.share.copyFailed);
    }
  }, [shareContent, i18n.share]);

  const handleDownloadShareContent = useCallback(() => {
    try {
      downloadConnectionExport(shareContent);
      message.success(i18n.share.downloadSuccess);
    } catch {
      message.error(i18n.share.downloadFailed);
    }
  }, [shareContent, i18n.share]);

  const openImportModal = useCallback(() => {
    setImportPreview([]);
    setImportError(null);
    setImportModalOpen(true);
  }, []);

  const closeImportModal = useCallback(() => {
    setImportModalOpen(false);
    setImportPreview([]);
    setImportError(null);
  }, []);

  const parseImportText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setImportPreview([]);
      setImportError(null);
      return;
    }

    try {
      const parsed = parseConnectionExport(trimmed);
      setImportPreview(parsed);
      setImportError(null);
    } catch (error) {
      setImportPreview([]);
      setImportError(error instanceof Error ? error.message : i18n.import.parseFailed);
    }
  }, [i18n.import.parseFailed]);

  const handleImportFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content !== 'string') {
        setImportError(i18n.import.parseFailed);
        return;
      }
      parseImportText(content);
    };
    reader.onerror = () => {
      setImportError(i18n.import.parseFailed);
    };
    reader.readAsText(file);
  }, [parseImportText, i18n.import.parseFailed]);

  const handleConfirmImport = useCallback(async () => {
    if (importPreview.length === 0) {
      return;
    }

    setImporting(true);
    const existingNames = connections.map((conn) => conn.name);
    const assignedNames: string[] = [...existingNames];

    try {
      for (const item of importPreview) {
        const resolvedName = resolveImportName(item.name, assignedNames, i18n.import.nameSuffix);
        assignedNames.push(resolvedName);
        await ApiService.addConnection(resolvedName, item.protocol_type, item.config);
      }

      message.success(
        importPreview.length === 1
          ? i18n.import.importSuccessSingle
          : i18n.import.importSuccessMultiple.replace('{count}', String(importPreview.length))
      );
      closeImportModal();
      onConnectionsChange();
    } catch {
      message.error(i18n.import.importFailed);
    } finally {
      setImporting(false);
    }
  }, [
    importPreview,
    connections,
    i18n.import,
    closeImportModal,
    onConnectionsChange,
  ]);

  return {
    shareModalOpen,
    shareContent,
    importModalOpen,
    importPreview,
    importError,
    importing,
    handleShareConnection,
    handleExportAll,
    closeShareModal,
    handleCopyShareContent,
    handleDownloadShareContent,
    openImportModal,
    closeImportModal,
    parseImportText,
    handleImportFile,
    handleConfirmImport,
  };
};
