import { readHeartbeatInboxConfig } from '../heartbeat/heartbeatInboxSettings';
import type { ProviderProtocol } from '../../types/domain';

export type FarmTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type FarmPublicConfig = {
  version: number;
  humanUrl: string;
  agentKeyConfigured: boolean;
  autonomousEnabled: boolean;
  protocol: ProviderProtocol;
  baseUrl: string;
  path: string;
  model: string;
  apiKeyConfigured: boolean;
  enabledToolNames: string[];
};

export type FarmConfigDraft = {
  humanUrl: string;
  agentKey?: string;
  autonomousEnabled: boolean;
  protocol: ProviderProtocol;
  baseUrl: string;
  path: string;
  apiKey?: string;
  model: string;
  enabledToolNames: string[];
};

function farmConnection() {
  const config = readHeartbeatInboxConfig();
  if (!config.endpoint || !config.token) {
    throw new Error('请先在“主动联系设置”中保存 Gateway 地址和访问密钥。');
  }
  return config;
}

export function farmEndpoint(heartbeatEndpoint: string, path = '') {
  const root = heartbeatEndpoint.trim().replace(/\/+$/, '').replace(/\/heartbeat(?:\/inbox)?$/, '/farm');
  return `${root}${path ? `/${path.replace(/^\/+/, '')}` : ''}`;
}

async function farmRequest<T>(path: string, method: 'GET' | 'POST' | 'PUT', body?: object) {
  const config = farmConnection();
  const response = await fetch(farmEndpoint(config.endpoint, path), {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const result = await response.json().catch(() => null) as T | { error?: string; message?: string } | null;
  if (!response.ok) {
    const detail = result && typeof result === 'object' && ('error' in result || 'message' in result)
      ? result.error || result.message
      : null;
    throw new Error(detail || `农场服务请求失败（${response.status}）`);
  }
  return result as T;
}

export function fetchFarmConfig() {
  return farmRequest<FarmPublicConfig>('config', 'GET');
}

export function saveFarmConfig(draft: FarmConfigDraft) {
  return farmRequest<FarmPublicConfig>('config', 'PUT', draft);
}

export function fetchFarmModels(draft: Pick<FarmConfigDraft, 'protocol' | 'baseUrl' | 'path' | 'apiKey' | 'model'>) {
  return farmRequest<{ models: string[] }>('models', 'POST', draft);
}

export function testFarmModel(draft: Pick<FarmConfigDraft, 'protocol' | 'baseUrl' | 'path' | 'apiKey' | 'model'>) {
  return farmRequest<{ ok: true; model: string; reply: string }>('test-model', 'POST', draft);
}

export function testFarmConnection(agentKey?: string) {
  return farmRequest<{ ok: true; tools: FarmTool[] }>('test-connection', 'POST', agentKey ? { agentKey } : {});
}
