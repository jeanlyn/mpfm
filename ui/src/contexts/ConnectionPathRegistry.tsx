import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';

interface ConnectionPathRegistryValue {
  registerPath: (connectionId: string, path: string) => void;
  getPath: (connectionId: string) => string;
  registerRefresh: (connectionId: string, refresh: () => void) => void;
  unregisterRefresh: (connectionId: string) => void;
  refreshConnection: (connectionId: string) => void;
}

const ConnectionPathRegistryContext = createContext<ConnectionPathRegistryValue | null>(null);

export const ConnectionPathRegistryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const pathsRef = useRef<Map<string, string>>(new Map());
  const refreshRef = useRef<Map<string, () => void>>(new Map());

  const registerPath = useCallback((connectionId: string, path: string) => {
    pathsRef.current.set(connectionId, path);
  }, []);

  const getPath = useCallback((connectionId: string) => {
    return pathsRef.current.get(connectionId) ?? '/';
  }, []);

  const registerRefresh = useCallback((connectionId: string, refresh: () => void) => {
    refreshRef.current.set(connectionId, refresh);
  }, []);

  const unregisterRefresh = useCallback((connectionId: string) => {
    refreshRef.current.delete(connectionId);
  }, []);

  const refreshConnection = useCallback((connectionId: string) => {
    refreshRef.current.get(connectionId)?.();
  }, []);

  const value = useMemo(
    () => ({
      registerPath,
      getPath,
      registerRefresh,
      unregisterRefresh,
      refreshConnection,
    }),
    [registerPath, getPath, registerRefresh, unregisterRefresh, refreshConnection]
  );

  return (
    <ConnectionPathRegistryContext.Provider value={value}>
      {children}
    </ConnectionPathRegistryContext.Provider>
  );
};

export const useConnectionPathRegistry = (): ConnectionPathRegistryValue => {
  const ctx = useContext(ConnectionPathRegistryContext);
  if (!ctx) {
    throw new Error('useConnectionPathRegistry must be used within ConnectionPathRegistryProvider');
  }
  return ctx;
};
