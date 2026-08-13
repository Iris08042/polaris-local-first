import { readHeartbeatInboxConfig } from './heartbeatInboxSettings';

export type HeartbeatModelConfig = {
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

async function requestConfig<T>(kind: 'model' | 'prompt', method: 'GET' | 'PUT', body?: object) {
  const config = connection();
  const response = await fetch(heartbeatRuntimeConfigEndpoint(config.endpoint, kind), {
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
    throw new Error(problem || `心跳${kind === 'model' ? '模型' : '提示词'}请求失败（${response.status}）`);
  }
  return result as T;
}

export function fetchHeartbeatModelConfig() {
  return requestConfig<HeartbeatModelConfig>('model', 'GET');
}

export function saveHeartbeatModelConfig(config: { apiUrl: string; model: string; apiKey?: string }) {
  return requestConfig<HeartbeatModelConfig>('model', 'PUT', config);
}

export function fetchHeartbeatPromptConfig() {
  return requestConfig<HeartbeatPromptConfig>('prompt', 'GET');
}

export function saveHeartbeatPromptConfig(prompt: string) {
  return requestConfig<HeartbeatPromptConfig>('prompt', 'PUT', { prompt });
}
