import type { HeartbeatInboxConfig } from './heartbeatInboxSettings';

export type HeartbeatInboxEvent = {
  id: string;
  content: string;
  createdAt: number;
};

function parseEvent(value: unknown): HeartbeatInboxEvent {
  if (!value || typeof value !== 'object') {
    throw new Error('心跳收件箱返回了无效消息。');
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || !record.id.trim()) {
    throw new Error('心跳消息缺少 id。');
  }
  if (typeof record.content !== 'string' || !record.content.trim()) {
    throw new Error(`心跳消息 ${record.id} 没有正文。`);
  }
  if (typeof record.createdAt !== 'number' || !Number.isFinite(record.createdAt)) {
    throw new Error(`心跳消息 ${record.id} 缺少有效时间。`);
  }

  return {
    id: record.id.trim(),
    content: record.content,
    createdAt: record.createdAt
  };
}

function authorizationHeaders(config: HeartbeatInboxConfig) {
  return {
    Authorization: `Bearer ${config.token}`,
    'Content-Type': 'application/json'
  };
}

export async function fetchHeartbeatInbox(
  config: HeartbeatInboxConfig,
  signal?: AbortSignal
): Promise<HeartbeatInboxEvent[]> {
  const response = await fetch(`${config.endpoint}/inbox`, {
    method: 'GET',
    headers: authorizationHeaders(config),
    cache: 'no-store',
    signal
  });
  if (!response.ok) {
    throw new Error(`读取心跳收件箱失败（HTTP ${response.status}）。`);
  }

  const payload = await response.json() as { events?: unknown };
  if (!Array.isArray(payload.events)) {
    throw new Error('心跳收件箱返回格式不正确。');
  }

  return payload.events.map(parseEvent).sort((left, right) => left.createdAt - right.createdAt);
}

export async function acknowledgeHeartbeatInbox(
  config: HeartbeatInboxConfig,
  eventIds: string[],
  signal?: AbortSignal
) {
  if (eventIds.length === 0) return;

  const response = await fetch(`${config.endpoint}/ack`, {
    method: 'POST',
    headers: authorizationHeaders(config),
    body: JSON.stringify({ ids: eventIds }),
    signal
  });
  if (!response.ok) {
    throw new Error(`确认心跳消息失败（HTTP ${response.status}）。`);
  }
}
