import { Connection } from '../../../types';

export const EXPORT_TYPE = 'mpfm-connection-export';
export const EXPORT_VERSION = '1.0';

const SUPPORTED_PROTOCOLS = ['s3', 'fs', 'ftp'] as const;
type SupportedProtocol = (typeof SUPPORTED_PROTOCOLS)[number];

export interface ConnectionExportItem {
  name: string;
  protocol_type: string;
  config: Record<string, string>;
}

export interface ConnectionExportPayload {
  type: typeof EXPORT_TYPE;
  version: typeof EXPORT_VERSION;
  exportTime: string;
  connections: ConnectionExportItem[];
}

function isSupportedProtocol(value: string): value is SupportedProtocol {
  return (SUPPORTED_PROTOCOLS as readonly string[]).includes(value);
}

function requireStringField(
  config: Record<string, unknown>,
  field: string,
  connectionLabel: string
): string {
  const value = config[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${connectionLabel}: missing required field "${field}"`);
  }
  return value.trim();
}

function validateConfig(protocolType: SupportedProtocol, config: unknown, connectionLabel: string): Record<string, string> {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`${connectionLabel}: invalid config object`);
  }

  const raw = config as Record<string, unknown>;
  const result: Record<string, string> = {};

  if (protocolType === 's3') {
    result.bucket = requireStringField(raw, 'bucket', connectionLabel);
    result.region = requireStringField(raw, 'region', connectionLabel);
    result.access_key = requireStringField(raw, 'access_key', connectionLabel);
    result.secret_key = requireStringField(raw, 'secret_key', connectionLabel);
    if (typeof raw.endpoint === 'string') {
      result.endpoint = raw.endpoint.trim();
    }
  } else if (protocolType === 'fs') {
    result.root_dir = requireStringField(raw, 'root_dir', connectionLabel);
  } else if (protocolType === 'ftp') {
    result.host = requireStringField(raw, 'host', connectionLabel);
    result.port = requireStringField(raw, 'port', connectionLabel);
    result.username = requireStringField(raw, 'username', connectionLabel);
    result.password = requireStringField(raw, 'password', connectionLabel);
    const rawRootDir = typeof raw.root_dir === 'string' ? raw.root_dir.trim() : '';
    result.root_dir = !rawRootDir || rawRootDir === '/' ? '/' : rawRootDir.startsWith('/') ? rawRootDir : `/${rawRootDir}`;
    result.secure = raw.secure === 'true' ? 'true' : 'false';
  }

  return result;
}

function validateConnectionItem(item: unknown, index: number): ConnectionExportItem {
  const connectionLabel = `Connection #${index + 1}`;

  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`${connectionLabel}: invalid connection object`);
  }

  const raw = item as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) {
    throw new Error(`${connectionLabel}: name is required`);
  }

  const protocolType = typeof raw.protocol_type === 'string' ? raw.protocol_type.trim() : '';
  if (!isSupportedProtocol(protocolType)) {
    throw new Error(`${connectionLabel}: unsupported protocol "${protocolType}"`);
  }

  const config = validateConfig(protocolType, raw.config, connectionLabel);

  return {
    name,
    protocol_type: protocolType,
    config,
  };
}

export function serializeConnections(connections: Connection[]): string {
  const payload: ConnectionExportPayload = {
    type: EXPORT_TYPE,
    version: EXPORT_VERSION,
    exportTime: new Date().toISOString(),
    connections: connections.map(({ name, protocol_type, config }) => ({
      name,
      protocol_type,
      config: { ...config },
    })),
  };
  return JSON.stringify(payload, null, 2);
}

export function parseConnectionExport(text: string): ConnectionExportItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON format');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid export format');
  }

  const payload = parsed as Record<string, unknown>;

  if (payload.type !== EXPORT_TYPE) {
    throw new Error(`Invalid export type, expected "${EXPORT_TYPE}"`);
  }

  if (payload.version !== EXPORT_VERSION) {
    throw new Error(`Unsupported export version "${String(payload.version)}"`);
  }

  if (!Array.isArray(payload.connections) || payload.connections.length === 0) {
    throw new Error('Export must contain at least one connection');
  }

  return payload.connections.map((item, index) => validateConnectionItem(item, index));
}

export function resolveImportName(name: string, existingNames: string[], suffix: string): string {
  const normalizedExisting = new Set(existingNames);
  if (!normalizedExisting.has(name)) {
    return name;
  }

  const baseName = `${name}${suffix}`;
  if (!normalizedExisting.has(baseName)) {
    return baseName;
  }

  let counter = 2;
  while (normalizedExisting.has(`${baseName}(${counter})`)) {
    counter += 1;
  }
  return `${baseName}(${counter})`;
}

export function downloadConnectionExport(content: string, filename?: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename ?? `mpfm-connections-${new Date().toISOString().split('T')[0]}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
