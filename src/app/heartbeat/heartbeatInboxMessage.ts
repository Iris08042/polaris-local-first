import { createMessage } from '../../engines/chatMessageFactory';
import type { ChatMessage } from '../../types/domain';
import type { HeartbeatInboxEvent } from './heartbeatInboxClient';

export function heartbeatInboxMessageId(eventId: string) {
  return `heartbeat-inbox:${eventId}`;
}

export function createHeartbeatInboxMessage(
  event: HeartbeatInboxEvent,
  collaboratorId: string,
  assistantName: string
): ChatMessage {
  return {
    ...createMessage(
      'assistant',
      event.content,
      undefined,
      'assistant-reply',
      heartbeatInboxMessageId(event.id)
    ),
    timestamp: event.createdAt,
    assistantName,
    speakerCollaboratorId: collaboratorId
  };
}
