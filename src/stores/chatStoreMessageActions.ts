import { sortConversations } from './chatCurrentPersistence';
import {
  assertWritableConversationBody,
  createBodyStatus,
  withConversationBodyStatus
} from './chatConversationBodyStatus';
import {
  appendConversationMessageInRecords,
  insertConversationMessageAfterInRecords,
  insertConversationMessageBeforeInRecords,
  replaceConversationMessagesInRecords,
  updateConversationMessageInRecords
} from './chatConversationMessages';
import { markConversationDirty } from './chatPersistenceMarkers';
import { flushChatPersistenceIfHydrated } from './chatStoreFlush';
import type { ChatState, ChatStoreGet, ChatStoreSet } from './chatStoreTypes';

type ChatMessageActions = Pick<
  ChatState,
  | 'addMessage'
  | 'insertMessageBefore'
  | 'insertMessageAfter'
  | 'updateMessage'
  | 'setConversationRollingSummary'
  | 'replaceConversationMessages'
>;

export function createChatMessageActions(
  set: ChatStoreSet,
  get: ChatStoreGet
): ChatMessageActions {
  return {
    addMessage: (target, message) => {
      const conversationId = target.conversationId;
      set((state) => {
        assertWritableConversationBody(state, conversationId, 'add message');
        return {
          conversations: sortConversations(
            appendConversationMessageInRecords(state.conversations, conversationId, message)
          ),
          ...withConversationBodyStatus(state, conversationId, createBodyStatus('loaded')),
          ...markConversationDirty(state, conversationId)
        };
      });
      if (message.role === 'user') {
        flushChatPersistenceIfHydrated(get, 'add-user-message-flush');
      }
    },

    insertMessageBefore: (target, beforeMessageId, message) => {
      const conversationId = target.conversationId;
      set((state) => {
        assertWritableConversationBody(state, conversationId, 'insert message');
        return {
          conversations: sortConversations(
            insertConversationMessageBeforeInRecords(state.conversations, conversationId, beforeMessageId, message)
          ),
          ...withConversationBodyStatus(state, conversationId, createBodyStatus('loaded')),
          ...markConversationDirty(state, conversationId)
        };
      });
    },

    insertMessageAfter: (target, afterMessageId, message) => {
      const conversationId = target.conversationId;
      set((state) => {
        assertWritableConversationBody(state, conversationId, 'insert message');
        return {
          conversations: sortConversations(
            insertConversationMessageAfterInRecords(state.conversations, conversationId, afterMessageId, message)
          ),
          ...withConversationBodyStatus(state, conversationId, createBodyStatus('loaded')),
          ...markConversationDirty(state, conversationId)
        };
      });
    },

    updateMessage: (target, messageId, patch) => {
      const conversationId = target.conversationId;
      set((state) => {
        assertWritableConversationBody(state, conversationId, 'update message');
        return {
          conversations: updateConversationMessageInRecords(state.conversations, conversationId, messageId, patch),
          ...withConversationBodyStatus(state, conversationId, createBodyStatus('loaded')),
          ...markConversationDirty(state, conversationId)
        };
      });
    },

    setConversationRollingSummary: (conversationId, summary) => {
      set((state) => ({
        conversations: state.conversations.map((conversation) => conversation.id === conversationId
          ? { ...conversation, rollingSummary: summary, updatedAt: Date.now() }
          : conversation),
        ...markConversationDirty(state, conversationId)
      }));
      flushChatPersistenceIfHydrated(get, 'rolling-summary-flush');
    },

    replaceConversationMessages: (target, messages) => {
      const conversationId = target.conversationId;
      set((state) => {
        assertWritableConversationBody(state, conversationId, 'replace conversation messages');
        return {
          conversations: sortConversations(
            replaceConversationMessagesInRecords(state.conversations, conversationId, messages)
          ),
          ...withConversationBodyStatus(state, conversationId, createBodyStatus('loaded')),
          ...markConversationDirty(state, conversationId)
        };
      });
    }
  };
}
