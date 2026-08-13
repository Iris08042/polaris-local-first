import { readHeartbeatInboxConfig } from './heartbeatInboxSettings';

export type HeartbeatModelProfile = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKeyConfigured: boolean;
};

export type HeartbeatModelConfig = {
  version: 2;
  activeProfileId: string;
  profiles: HeartbeatModelProfile[];
  baseUrl: string;
  apiUrl: string;
  model: string;
  apiKeyConfigured: boolean;
  source: 'shared' | 'heartbeat';
};

export type HeartbeatPromptConfig = {
  prompt: string;
  source: 'default' | 'environment' | 'file' | 'heartbeat';
};

function connection() {
  const config = readHeartbeatInboxConfig();
  if (!config.endpoint || !config.token) {
    throw new Error('请先填写并保存云端心跳收件箱地址和密钥。');
  }
  return config;
}

export function heartbeatRuntimeConfigEndpoint(inboxEndpoint: string, kind: 'model' | 'prompt') {
  return `${inboxEndpoint.replace(/\/inbox$/, '')}/${kind}`;
}

async function requestConfig<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: object) {
  const config = connection();
  const root = config.endpoint.replace(/\/inbox$/, '');
  const response = await fetch(`${root}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const result = await response.json().catch(() => null) as T | { error?: string; message?: string } | null;
  if (!response.ok) {
    const problem = result && typeof result === 'object' && ('error' in result || 'message' in result)
      ? result.error || result.message
      : null;
    throw new Error(problem || `主动消息设置请求失败（${response.status}）`);
  }
  return result as T;
}

export function fetchHeartbeatModelConfig() {
  return requestConfig<HeartbeatModelConfig>('model', 'GET');
}

export type HeartbeatModelProfileDraft = {
  id?: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export function saveHeartbeatModelProfile(profile: HeartbeatModelProfileDraft) {
  return requestConfig<HeartbeatModelConfig>('model/profile', 'PUT', profile);
}

export function activateHeartbeatModelProfile(id: string) {
  return requestConfig<HeartbeatModelConfig>('model/active', 'PUT', { id });
}

export function deleteHeartbeatModelProfile(id: string) {
  return requestConfig<HeartbeatModelConfig>(`model/profile/${encodeURIComponent(id)}`, 'DELETE');
}

export function fetchHeartbeatModels(profile: Omit<HeartbeatModelProfileDraft, 'name'>) {
  return requestConfig<{ models: string[] }>('model/models', 'POST', profile);
}

export function testHeartbeatModel(profile: Omit<HeartbeatModelProfileDraft, 'name'>) {
  return requestConfig<{ ok: true; model: string; reply: string }>('model/test', 'POST', profile);
}

export function fetchHeartbeatPromptConfig() {
  return requestConfig<HeartbeatPromptConfig>('prompt', 'GET');
}

export function saveHeartbeatPromptConfig(prompt: string) {
  return requestConfig<HeartbeatPromptConfig>('prompt', 'PUT', { prompt });
}
