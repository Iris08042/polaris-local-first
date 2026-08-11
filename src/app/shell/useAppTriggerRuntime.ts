import { useMemo } from 'react';
import { useChatDerived } from '../chat/chatDerivedState';
import { createChatReplyRunner } from '../chat/chatReplyFlow';
import { createChatToolActions } from '../chat/chatToolActions';
import {
  createChatReplyStoreBindings,
  createChatToolStoreBindings,
  useChatStoreBindings
} from '../chat/useChatStoreBindings';
import { createCompanionPersonaProjection } from '../../engines/companion';
import type { ChatStreamingState, ChatUiReplyControllerState, ChatUiToolState } from '../chat/chatPorts';
import { useChatTriggerRuntime } from '../chat/useChatTriggerRuntime';
import { useAppTriggerShortcutRuntime } from './useAppTriggerShortcutRuntime';
import { useNativeTriggerNotifications } from './useNativeTriggerNotifications';
import { selectChatConversations } from '../chat/liveConversationCatalog';
import { useHeartbeatInboxRuntime } from '../heartbeat/useHeartbeatInboxRuntime';

type TriggerConversationGenerationState = {
  sending: boolean;
  streaming: ChatStreamingState;
};

export type AppTriggerChatRuntimePort = Pick<
  ChatUiReplyControllerState,
  'themeToolModeSwitchRef' | 'getConversationGenerationControls'
> & Pick<ChatUiToolState, 'setCommandStatus'> & {
  generationByConversationId: Record<string, TriggerConversationGenerationState | undefined>;
};

type UseAppTriggerRuntimeArgs = {
  chatRuntime: AppTriggerChatRuntimePort;
  startupReady: boolean;
};

export function useAppTriggerRuntime({ chatRuntime, startupReady }: UseAppTriggerRuntimeArgs) {
  const store = useChatStoreBindings();
  const collaborators = useMemo(
    () => [
      ...store.persona.personas,
      ...store.runtime.companionConnections.map((connection) =>
        createCompanionPersonaProjection(connection, store.runtime.companionSnapshots[connection.id] ?? null)
      )
    ],
    [store.persona.personas, store.runtime.companionConnections, store.runtime.companionSnapshots]
  );
  const triggerRuntimeReady =
    startupReady
    && store.chat.hydrated
    && store.persona.hydrated
    && store.runtime.hydrated
    && store.collection.hydrated;
  const liveConversations = selectChatConversations(store.chat.conversations);

  const derived = useChatDerived({
    startupReady: triggerRuntimeReady,
    activeConversationId: store.chat.activeConversationId,
    activeThemePreview: store.space.activeThemePreview,
    frontstageCollaboratorId: store.space.frontstageCollaboratorId,
    activeCollaboratorId: store.persona.activeCollaboratorId,
    inputDraft: store.chat.inputDraft,
    conversationSearch: '',
    conversations: liveConversations,
    personas: collaborators,
    pendingAttachments: store.space.pendingAttachments,
    pendingCardReference: store.space.pendingCardReference,
    api: store.runtime.api,
    providers: store.runtime.providers,
    streaming: store.chat.activeConversationId
      ? chatRuntime.generationByConversationId[store.chat.activeConversationId]?.streaming ?? null
      : null,
    sending: store.chat.activeConversationId
      ? chatRuntime.generationByConversationId[store.chat.activeConversationId]?.sending ?? false
      : false,
    collectionCards: store.collection.cards,
    focusedMessageTarget: store.space.focusedMessageTarget
  });
  const replyStore = createChatReplyStoreBindings(store);
  const toolStore = createChatToolStoreBindings(store);
  const toolActions = useMemo(
    () => createChatToolActions({ ui: chatRuntime, store: toolStore, derived }),
    [chatRuntime, derived, toolStore]
  );
  const runReply = createChatReplyRunner({
    ui: {
      themeToolModeSwitchRef: chatRuntime.themeToolModeSwitchRef,
      getConversationGenerationControls: chatRuntime.getConversationGenerationControls,
      toolPromptPreferences: store.runtime.toolPromptPreferences,
      taskModeEnabled: store.runtime.taskModeEnabled
    },
    store: replyStore,
    derived,
    toolActions,
    createToolActions: (scopedDerived) => createChatToolActions({ ui: chatRuntime, store: toolStore, derived: scopedDerived })
  });

  useChatTriggerRuntime({
    startupReady: triggerRuntimeReady,
    generationByConversationId: chatRuntime.generationByConversationId,
    store,
    runReply,
    setCommandStatus: chatRuntime.setCommandStatus
  });
  useHeartbeatInboxRuntime({
    startupReady: triggerRuntimeReady,
    store,
    setCommandStatus: chatRuntime.setCommandStatus
  });
  useAppTriggerShortcutRuntime({
    startupReady: triggerRuntimeReady,
    setCommandStatus: chatRuntime.setCommandStatus
  });
  useNativeTriggerNotifications({
    startupReady: triggerRuntimeReady,
    personas: collaborators,
    triggerRules: store.runtime.triggerRules,
    setCommandStatus: chatRuntime.setCommandStatus
  });
}
