import { readHeartbeatInboxConfig } from '../heartbeat/heartbeatInboxSettings';

export type HealthPoint = Record<string, string | number | boolean | null | undefined>;

export type HealthMetric = {
  label: string;
  units?: string;
  available?: false;
  sampleAt?: string | null;
  receivedAt?: number | null;
  value?: HealthPoint;
};

export type HealthSnapshot = {
  queriedAt: number;
  lastUploadAt: number | null;
  metrics: Record<string, HealthMetric>;
  text: string;
};

function healthConnection() {
  const config = readHeartbeatInboxConfig();
  if (!config.endpoint || !config.token) {
    throw new Error('请先在“主动联系设置”中保存 Gateway 地址和访问密钥。');
  }
  return config;
}

export function healthEndpoint(heartbeatEndpoint: string, path = '') {
  const root = heartbeatEndpoint.trim().replace(/\/+$/, '').replace(/\/heartbeat(?:\/inbox)?$/, '/health');
  return `${root}${path ? `/${path.replace(/^\/+/, '')}` : ''}`;
}

export async function fetchHealthSnapshot() {
  const config = healthConnection();
  const response = await fetch(healthEndpoint(config.endpoint, 'status'), {
    headers: { Authorization: `Bearer ${config.token}` }
  });
  const result = await response.json().catch(() => null) as HealthSnapshot | { error?: string } | null;
  if (!response.ok) {
    const detail = result && typeof result === 'object' && 'error' in result ? result.error : null;
    throw new Error(detail || `健康数据请求失败（${response.status}）`);
  }
  return result as HealthSnapshot;
}
