import {
  isCloudBackupConfigured,
  readCloudBackupConfig,
  type CloudBackupConfig
} from '../backup/cloudBackupSettings';

export type OmbreStatus = {
  available: boolean;
  version: string | null;
  total: number;
  permanent: number;
  dynamic: number;
  archived: number;
};

export type OmbreBucket = {
  id: string;
  name: string;
  content: string;
  contentPreview: string;
  type: string;
  domains: string[];
  tags: string[];
  importance: number;
  valence: number | null;
  arousal: number | null;
  pinned: boolean;
  resolved: boolean;
  digested: boolean;
  protected: boolean;
  anchor: boolean;
  archived: boolean;
  dontSurface: boolean;
  whyRemembered: string;
  sourceTool: string;
  activationCount: number;
  createdAt: string | null;
  lastActiveAt: string | null;
};

export type OmbreBucketList = { items: OmbreBucket[]; total: number };

export type OmbreBreathDebugResult = {
  totalCandidates?: number;
  threshold?: number;
  passedCount?: number;
  weights?: Record<string, number>;
  results?: Array<{
    id?: string;
    name?: string;
    type?: string;
    finalScore?: number;
    passed?: boolean;
    scores?: Record<string, number>;
  }>;
};

export function resolveOmbreProxyConfig(config: CloudBackupConfig = readCloudBackupConfig()) {
  const endpoint = config.endpoint.replace(/\/backup$/i, '/ombre');
  return {
    configured: isCloudBackupConfigured(config) && endpoint !== config.endpoint,
    endpoint,
    token: config.token
  };
}

async function requireOk(response: Response) {
  if (response.ok) return response;
  let message = '';
  try {
    const payload = await response.json() as { message?: unknown; error?: unknown };
    message = String(payload.message || payload.error || '');
  } catch {}
  throw new Error(message || `Ombre Brain 请求失败（HTTP ${response.status}）`);
}

async function requestOmbre<T>(path: string, init?: RequestInit): Promise<T> {
  const config = resolveOmbreProxyConfig();
  if (!config.configured) throw new Error('请先在“备份与恢复”中配置腾讯云地址和密钥。');
  const response = await fetch(`${config.endpoint}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers
    }
  });
  await requireOk(response);
  return await response.json() as T;
}

export function fetchOmbreStatus() {
  return requestOmbre<OmbreStatus>('/status');
}

export function fetchOmbreBuckets(filter: { type?: string; state?: string } = {}) {
  const params = new URLSearchParams();
  if (filter.type) params.set('type', filter.type);
  if (filter.state) params.set('state', filter.state);
  const query = params.toString();
  return requestOmbre<OmbreBucketList>(`/buckets${query ? `?${query}` : ''}`);
}

export function searchOmbreBuckets(query: string) {
  return requestOmbre<OmbreBucketList>(`/search?q=${encodeURIComponent(query)}`);
}

export function fetchOmbreBucket(id: string) {
  return requestOmbre<OmbreBucket>(`/buckets/${encodeURIComponent(id)}`);
}

export function runOmbreBucketAction(id: string, action: 'pin' | 'resolve' | 'archive' | 'forget' | 'anchor') {
  return requestOmbre<Record<string, unknown>>(`/buckets/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    body: '{}'
  });
}

export function runOmbreBreathDebug(query: string, coordinates: { valence?: string; arousal?: string }) {
  const params = new URLSearchParams({ q: query });
  if (coordinates.valence) params.set('valence', coordinates.valence);
  if (coordinates.arousal) params.set('arousal', coordinates.arousal);
  return requestOmbre<OmbreBreathDebugResult>(`/breath-debug?${params.toString()}`);
}
