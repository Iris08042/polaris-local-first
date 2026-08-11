import { useEffect, useRef, useState } from 'react';
import type { ChatStoreBindings } from '../chat/useChatStoreBindings';
import { selectChatConversations } from '../chat/liveConversationCatalog';
import { resolveTriggerConversationForTarget } from '../chat/triggerConversationResolution';
import { acknowledgeHeartbeatInbox, fetchHeartbeatInbox } from './heartbeatInboxClient';
import { createHeartbeatInboxMessage, heartbeatInboxMessageId } from './heartbeatInboxMessage';
import {
  HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT,
  HEARTBEAT_INBOX_SYNC_REQUESTED_EVENT,
  readHeartbeatInboxConfig
} from './heartbeatInboxSettings';

type UseHeartbeatInboxRuntimeArgs = {
  startupReady: boolean;
  store: ChatStoreBindings;
  setCommandStatus: (text: string, isError?: boolean) => void;
};

function resolveInboxConversation(store: ChatStoreBindings, collaboratorId: string, conversationId: string | null) {
  const chatState = store.chat.readLatestState();
  return resolveTriggerConversationForTarget({
    collaboratorId,
    conversationMode: conversationId ? 'fixed' : 'follow-latest',
    conversationId
  }, {
    conversations: selectChatConversations(chatState.conversations),
    activeConversationId: chatState.activeConversationId
  }, {
    createConversation: (targetCollaboratorId) => store.chat.createConversation(targetCollaboratorId),
    getConversations: () => selectChatConversations(store.chat.readLatestState().conversations)
  });
}

export function useHeartbeatInboxRuntime({
  startupReady,
  store,
  setCommandStatus
}: UseHeartbeatInboxRuntimeArgs) {
  const runningRef = useRef(false);
  const storeRef = useRef(store);
  const [wakeTick, setWakeTick] = useState(0);
  storeRef.current = store;

  useEffect(() => {
    if (!startupReady || typeof window === 'undefined') return;

    const wake = () => setWakeTick((current) => current + 1);
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') wake();
    };

    window.addEventListener('focus', wake);
    window.addEventListener('pageshow', wake);
    window.addEventListener(HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT, wake);
    window.addEventListener(HEARTBEAT_INBOX_SYNC_REQUESTED_EVENT, wake);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', wake);
      window.removeEventListener('pageshow', wake);
      window.removeEventListener(HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT, wake);
      window.removeEventListener(HEARTBEAT_INBOX_SYNC_REQUESTED_EVENT, wake);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startupReady]);

  useEffect(() => {
    if (!startupReady || runningRef.current) return;

    const config = readHeartbeatInboxConfig();
    if (!config.enabled || !config.endpoint || !config.token || !config.collaboratorId) return;

    const runtimeStore = storeRef.current;
    const persona = runtimeStore.persona.readLatestState().personas.find(
      (entry) => entry.id === config.collaboratorId
    ) ?? null;
    if (!persona) {
      setCommandStatus('心跳收件箱绑定的协作者不存在。', true);
      return;
    }

    const controller = new AbortController();
    runningRef.current = true;

    void (async () => {
      try {
        const events = await fetchHeartbeatInbox(config, controller.signal);
        if (events.length === 0) return;

        const conversation = resolveInboxConversation(
          runtimeStore,
          config.collaboratorId,
          config.conversationId
        );
        if (!conversation) throw new Error('找不到心跳消息要写入的对话。');

        const writableConversation = await runtimeStore.chat.ensureConversationWritable(conversation.id);
        if (!writableConversation) throw new Error('目标对话还没有准备好。');

        const existingIds = new Set(writableConversation.messages.map((message) => message.id));
        let importedCount = 0;
        for (const event of events) {
          const messageId = heartbeatInboxMessageId(event.id);
          if (existingIds.has(messageId)) continue;

          runtimeStore.chat.addMessage(
            writableConversation,
            createHeartbeatInboxMessage(event, config.collaboratorId, persona.name)
          );
          existingIds.add(messageId);
          importedCount += 1;
        }

        if (importedCount > 0) await runtimeStore.chat.persistToDb();

        await acknowledgeHeartbeatInbox(
          config,
          events.map((event) => event.id),
          controller.signal
        );

        if (importedCount > 0) setCommandStatus(`已收进 ${importedCount} 条心跳消息。`);
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : '同步心跳消息失败。';
        setCommandStatus(message, true);
      } finally {
        runningRef.current = false;
      }
    })();

    return () => controller.abort();
  }, [setCommandStatus, startupReady, wakeTick]);
}
