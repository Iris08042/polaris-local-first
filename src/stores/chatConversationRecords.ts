import { createUid } from '../engines/id';
import type { Conversation } from '../types/domain';

export function createDirectConversationRecord(args: {
  collaboratorId?: string | null;
  activeProjectId?: string | null;
} = {}): Conversation {
  return {
    id: createUid('c'),
    title: '新对话',
    kind: 'direct',
    collaboratorId: args.collaboratorId ?? null,
    groupRoomId: null,
    activeProjectId: args.activeProjectId ?? null,
    toolLedger: undefined,
    draft: '',
    pinnedAt: null,
    updatedAt: Date.now(),
    messages: []
  };
}

export function touchConversationRecord(conversation: Conversation): Conversation {
  return {
    ...conversation,
    updatedAt: Date.now()
  };
}

export function touchConversationInRecords(
  conversations: Conversation[],
  conversationId: string
): Conversation[] {
  return conversations.map((conversation) =>
    conversation.id === conversationId ? touchConversationRecord(conversation) : conversation
  );
}

export function renameConversationRecord(conversation: Conversation, title: string): Conversation {
  return {
    ...conversation,
    title,
    updatedAt: Date.now()
  };
}

export function renameConversationInRecords(
  conversations: Conversation[],
  conversationId: string,
  title: string
): Conversation[] | null {
  const nextTitle = title.trim();
  if (!nextTitle) return null;
  return conversations.map((conversation) =>
    conversation.id === conversationId ? renameConversationRecord(conversation, nextTitle) : conversation
  );
}

export function toggleConversationPinnedRecord(conversation: Conversation): Conversation {
  return {
    ...conversation,
    pinnedAt: conversation.pinnedAt ? null : Date.now()
  };
}

export function toggleConversationPinnedInRecords(
  conversations: Conversation[],
  conversationId: string
): Conversation[] {
  return conversations.map((conversation) =>
    conversation.id === conversationId ? toggleConversationPinnedRecord(conversation) : conversation
  );
}

export function orphanConversationRecord(conversation: Conversation): Conversation {
  return {
    ...conversation,
    collaboratorId: null
  };
}

export function orphanConversationInRecords(
  conversations: Conversation[],
  conversationId: string
): Conversation[] {
  return conversations.map((conversation) =>
    conversation.id === conversationId
      ? orphanConversationRecord(conversation)
      : conversation
  );
}
