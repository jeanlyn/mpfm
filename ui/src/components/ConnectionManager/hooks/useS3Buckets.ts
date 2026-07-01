import { useCallback, useState, useEffect, useRef } from 'react';
import { message } from 'antd';
import { Connection } from '../../../types';
import { ApiService } from '../../../services/api';
import { useAppI18n } from '../../../i18n/hooks/useI18n';

interface BucketCacheEntry {
  buckets: string[];
  loadFailed: boolean;
}

export const useS3Buckets = (
  currentConnection: Connection | null,
  onConnectionSelect: (connection: Connection) => void,
  onConnectionsChange: () => void
) => {
  const { connection: { s3Buckets: i18n } } = useAppI18n();
  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({});
  const [bucketCache, setBucketCache] = useState<Record<string, BucketCacheEntry>>({});
  const [loadingBuckets, setLoadingBuckets] = useState<Record<string, boolean>>({});
  const [switchingBucket, setSwitchingBucket] = useState<string | null>(null);
  const [creatingBucket, setCreatingBucket] = useState<string | null>(null);
  const prevConnectionIdRef = useRef<string | null>(currentConnection?.id ?? null);

  useEffect(() => {
    const prevId = prevConnectionIdRef.current;
    const currentId = currentConnection?.id ?? null;
    if (prevId && prevId !== currentId) {
      setExpandedPanels((prev) => ({ ...prev, [prevId]: false }));
    }
    prevConnectionIdRef.current = currentId;
  }, [currentConnection?.id]);

  const getS3Credentials = (connection: Connection) => ({
    region: connection.config.region || '',
    endpoint: connection.config.endpoint || null,
    accessKey: connection.config.access_key || '',
    secretKey: connection.config.secret_key || '',
  });

  const isBucketExpanded = useCallback(
    (connectionId: string) => expandedPanels[connectionId] ?? false,
    [expandedPanels]
  );

  const loadBuckets = useCallback(async (connection: Connection) => {
    const { region, endpoint, accessKey, secretKey } = getS3Credentials(connection);
    setLoadingBuckets((prev) => ({ ...prev, [connection.id]: true }));

    try {
      const buckets = await ApiService.listS3Buckets(region, endpoint, accessKey, secretKey);
      const currentBucket = connection.config.bucket;
      const mergedBuckets = currentBucket && !buckets.includes(currentBucket)
        ? [currentBucket, ...buckets]
        : buckets;

      setBucketCache((prev) => ({
        ...prev,
        [connection.id]: { buckets: mergedBuckets, loadFailed: false },
      }));
    } catch {
      const currentBucket = connection.config.bucket;
      setBucketCache((prev) => ({
        ...prev,
        [connection.id]: {
          buckets: currentBucket ? [currentBucket] : [],
          loadFailed: true,
        },
      }));
      message.warning(i18n.loadFailed);
    } finally {
      setLoadingBuckets((prev) => ({ ...prev, [connection.id]: false }));
    }
  }, [i18n.loadFailed]);

  const handleToggleExpand = useCallback(
    (connection: Connection) => {
      const willExpand = !isBucketExpanded(connection.id);
      setExpandedPanels((prev) => ({
        ...prev,
        [connection.id]: !prev[connection.id],
      }));
      if (willExpand) {
        loadBuckets(connection);
      }
    },
    [isBucketExpanded, loadBuckets]
  );

  const switchBucket = useCallback(
    async (connection: Connection, bucketName: string) => {
      const trimmed = bucketName.trim();
      if (!trimmed || connection.config.bucket === trimmed) return;

      setSwitchingBucket(connection.id);
      try {
        const updatedConfig = { ...connection.config, bucket: trimmed };
        const updated = await ApiService.updateConnection(
          connection.id,
          connection.name,
          connection.protocol_type,
          updatedConfig
        );
        message.success(i18n.switchSuccess);
        onConnectionsChange();
        if (currentConnection?.id === connection.id) {
          onConnectionSelect(updated);
        }
      } catch (error) {
        message.error(`${i18n.switchFailed}: ${error}`);
      } finally {
        setSwitchingBucket(null);
      }
    },
    [currentConnection, i18n.switchSuccess, i18n.switchFailed, onConnectionSelect, onConnectionsChange]
  );

  const createBucket = useCallback(
    async (connection: Connection, bucketName: string) => {
      const trimmed = bucketName.trim();
      if (!trimmed) return;

      const { region, endpoint, accessKey, secretKey } = getS3Credentials(connection);
      setCreatingBucket(connection.id);
      try {
        await ApiService.createS3Bucket(trimmed, region, endpoint, accessKey, secretKey);
        message.success(i18n.createSuccess);
        await loadBuckets(connection);
        await switchBucket(connection, trimmed);
      } catch (error) {
        message.error(`${i18n.createFailed}: ${error}`);
      } finally {
        setCreatingBucket(null);
      }
    },
    [i18n.createSuccess, i18n.createFailed, loadBuckets, switchBucket]
  );

  const getBucketsForConnection = useCallback(
    (connection: Connection): string[] => {
      const cached = bucketCache[connection.id];
      if (cached) return cached.buckets;
      const currentBucket = connection.config.bucket;
      return currentBucket ? [currentBucket] : [];
    },
    [bucketCache]
  );

  return {
    isBucketExpanded,
    handleToggleExpand,
    loadBuckets,
    switchBucket,
    createBucket,
    getBucketsForConnection,
    isLoadingBuckets: (connectionId: string) => loadingBuckets[connectionId] ?? false,
    isLoadFailed: (connectionId: string) => bucketCache[connectionId]?.loadFailed ?? false,
    isSwitchingBucket: (connectionId: string) => switchingBucket === connectionId,
    isCreatingBucket: (connectionId: string) => creatingBucket === connectionId,
  };
};
