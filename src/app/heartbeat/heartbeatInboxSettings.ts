export const HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT = 'polaris:heartbeat-inbox-config-changed';
export const HEARTBEAT_INBOX_SYNC_REQUESTED_EVENT = 'polaris:heartbeat-inbox-sync-requested';

const HEARTBEAT_INBOX_STORAGE_KEY = 'polaris-heartbeat-inbox-v1';

export type HeartbeatInboxConfig = {
  enabled: boolean;
  endpoint: string;
  token: string;
  collaboratorId: string;
  conversationId: string | null;
};

export const EMPTY_HEARTBEAT_INBOX_CONFIG: HeartbeatInboxConfig = {
  enabled: false,
  endpoint: '',
  token: '',
  collaboratorId: '',
  conversationId: null
};

function normalizeEndpoint(value: string) {
  return value.trim().replace(/\/+$/, '');
}

export function normalizeHeartbeatInboxConfig(
  value: Partial<HeartbeatInboxConfig>
): HeartbeatInboxConfig {
  return {
    enabled: value.enabled === true,
    endpoint: normalizeEndpoint(typeof value.endpoint === 'string' ? value.endpoint : ''),
    token: typeof value.token === 'string' ? value.token.trim() : '',
    collaboratorId: typeof value.collaboratorId === 'string' ? value.collaboratorId.trim() : '',
    conversationId: typeof value.conversationId === 'string' && value.conversationId.trim()
      ? value.conversationId.trim()
      : null
  };
}

export function readHeartbeatInboxConfig(): HeartbeatInboxConfig {
  if (typeof window === 'undefined') return EMPTY_HEARTBEAT_INBOX_CONFIG;

  const raw = window.localStorage.getItem(HEARTBEAT_INBOX_STORAGE_KEY);
  if (!raw) return EMPTY_HEARTBEAT_INBOX_CONFIG;

  try {
    const parsed = JSON.parse(raw) as Partial<HeartbeatInboxConfig>;
    return normalizeHeartbeatInboxConfig(parsed);
  } catch {
    return EMPTY_HEARTBEAT_INBOX_CONFIG;
  }
}

export function writeHeartbeatInboxConfig(value: HeartbeatInboxConfig) {
  const normalized = normalizeHeartbeatInboxConfig(value);
  window.localStorage.setItem(HEARTBEAT_INBOX_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT));
  return normalized;
}

export function requestHeartbeatInboxSync() {
  window.dispatchEvent(new Event(HEARTBEAT_INBOX_SYNC_REQUESTED_EVENT));
}
