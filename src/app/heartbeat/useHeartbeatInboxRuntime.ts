import { useEffect, useRef } from 'react';
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

export async function persistThenAcknowledgeHeartbeatInbox(
  persistToDb: () => Promise<void>,
  acknowledge: () => Promise<void>
) {
  await persistToDb();
  await acknowledge();
}

export function createHeartbeatInboxSyncRunner(
  run: (signal: AbortSignal) => Promise<void>
) {
  let running = false;
  let pending = false;
  let stopped = false;
  let controller: AbortController | null = null;

  const start = () => {
    if (stopped || running) return;
    running = true;
    pending = false;
    controller = new AbortController();

    void run(controller.signal).finally(() => {
      running = false;
      controller = null;
      if (pending && !stopped) start();
    });
  };

  return {
    request(replaceCurrent = false) {
      if (stopped) return;
      if (running) {
        pending = true;
        if (replaceCurrent) controller?.abort();
        return;
      }
      start();
    },
    stop() {
      stopped = true;
      pending = false;
      controller?.abort();
    }
  };
}

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
  const storeRef = useRef(store);
  const setCommandStatusRef = useRef(setCommandStatus);
  storeRef.current = store;
  setCommandStatusRef.current = setCommandStatus;

  useEffect(() => {
    if (!startupReady || typeof window === 'undefined') return;

    const runner = createHeartbeatInboxSyncRunner(async (signal) => {
      const config = readHeartbeatInboxConfig();
      if (!config.enabled || !config.endpoint || !config.token || !config.collaboratorId) return;

      const runtimeStore = storeRef.current;
      const persona = runtimeStore.persona.readLatestState().personas.find(
        (entry) => entry.id === config.collaboratorId
      ) ?? null;
      if (!persona) {
        setCommandStatusRef.current('心跳收件箱绑定的协作者不存在。', true);
        return;
      }

      try {
        const events = await fetchHeartbeatInbox(config, signal);
        if (signal.aborted || events.length === 0) return;

        const conversation = resolveInboxConversation(
          runtimeStore,
          config.collaboratorId,
          config.conversationId
        );
        if (!conversation) throw new Error('找不到心跳消息要写入的对话。');

        const writableConversation = await runtimeStore.chat.ensureConversationWritable(conversation.id);
        if (signal.aborted) return;
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

        await persistThenAcknowledgeHeartbeatInbox(
          () => runtimeStore.chat.persistToDb(),
          () => acknowledgeHeartbeatInbox(
            config,
            events.map((event) => event.id),
            signal
          )
        );

        if (importedCount > 0) setCommandStatusRef.current(`已收进 ${importedCount} 条心跳消息。`);
      } catch (error) {
        if (signal.aborted) return;
        const message = error instanceof Error ? error.message : '同步心跳消息失败。';
        setCommandStatusRef.current(message, true);
      }
    });

    const wake = () => runner.request();
    const replaceConfig = () => runner.request(true);
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') wake();
    };

    window.addEventListener('focus', wake);
    window.addEventListener('pageshow', wake);
    window.addEventListener(HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT, replaceConfig);
    window.addEventListener(HEARTBEAT_INBOX_SYNC_REQUESTED_EVENT, wake);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    runner.request();

    return () => {
      runner.stop();
      window.removeEventListener('focus', wake);
      window.removeEventListener('pageshow', wake);
      window.removeEventListener(HEARTBEAT_INBOX_CONFIG_CHANGED_EVENT, replaceConfig);
      window.removeEventListener(HEARTBEAT_INBOX_SYNC_REQUESTED_EVENT, wake);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startupReady]);
}
