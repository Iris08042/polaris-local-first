import type { Conversation } from '../../types/domain';
import type { HeartbeatInboxConfig } from './heartbeatInboxSettings';

export type HeartbeatContextMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

export type HeartbeatContextPayload = {
  collaboratorId: string;
  conversationId: string;
  systemPrompt: string;
  messages: HeartbeatContextMessage[];
};

export function buildHeartbeatContextPayload(
  conversation: Conversation,
  collaboratorId: string,
  systemPrompt: string
): HeartbeatContextPayload | null {
  const messages = conversation.messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .filter((message) => !message.id.startsWith('heartbeat-inbox:'))
    .filter((message) => !['system-note', 'tool-runtime', 'trigger-runtime'].includes(message.origin ?? ''))
    .map((message) => ({
      id: message.id,
      role: message.role as 'user' | 'assistant',
      content: message.content.trim(),
      timestamp: message.timestamp
    }))
    .filter((message) => message.id && message.content && Number.isFinite(message.timestamp))
    .slice(-50);

  if (!messages.some((message) => message.role === 'user')) return null;
  return {
    collaboratorId,
    conversationId: conversation.id,
    systemPrompt: systemPrompt.trim(),
    messages
  };
}

export function heartbeatContextRevision(payload: HeartbeatContextPayload) {
  return JSON.stringify(payload);
}

export async function syncHeartbeatContext(
  config: HeartbeatInboxConfig,
  payload: HeartbeatContextPayload,
  signal?: AbortSignal
) {
  const response = await fetch(`${config.endpoint}/context`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal
  });
  if (!response.ok) {
    throw new Error(`同步主动消息上下文失败（HTTP ${response.status}）。`);
  }
}
