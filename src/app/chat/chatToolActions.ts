import type { ToolAction } from '../../engines/toolExecutor';
import type { LocalToolCommand } from '../../engines/toolExecutorTypes';
import { createChatCodeCardActions } from './chatCodeCardActions';
import { createChatImageAssetActions } from './chatImageAssetActions';
import {
  toActiveConversationCollaborator,
  toActiveConversationCollaboratorSession,
} from './chatConversationCollaborator';
import { createDisabledLegacyMemoryActions } from './disabledLegacyMemoryActions';
import { createToolActionRunner } from './chatToolActionRunner';
import type { ChatDerivedStatePort, ChatToolStoreBindings, ChatUiToolState } from './chatPorts';
import type { AssistantToolActionBatchOptions } from './chatToolActionTypes';
import { ensureConversationSession } from './chatConversationSession';
import { createAddRuntimeToolMessage } from './chatToolRuntimeMessages';
import { isOmbreToolAction, isOmbreToolInvocation } from '../../engines/tool-protocol/ombreMemoryContract';
import type { ToolActionRunOutcome } from './chatToolOutcome';

type CreateChatToolActionsArgs = {
  ui: Pick<ChatUiToolState, 'setCommandStatus'> & {
    openProviderSettings?: () => void;
  };
  store: ChatToolStoreBindings;
  derived: Pick<ChatDerivedStatePort, 'activeConversation' | 'activeCollaboratorSourceId' | 'codeCardActionModeByMessageId'>;
};

export function buildOmbreActivityReceipts(outcomes: ToolActionRunOutcome[]) {
  return outcomes.flatMap((outcome) => {
    const invocation = outcome.path === 'direct' ? outcome.toolInvocation : undefined;
    if (!isOmbreToolAction(outcome.action) && !isOmbreToolInvocation(invocation)) return [];
    const toolName = invocation?.mcpResult?.toolName
      ?? (outcome.action.kind === 'invokeMcpTool' ? outcome.action.toolName : 'memory');
    const succeeded = outcome.path === 'direct'
      && outcome.status === 'executed'
      && invocation?.mcpResult?.isError !== true
      && Boolean(invocation?.mcpResult);
    return [`OB 操作${succeeded ? '已完成' : '失败'} · ${toolName}`];
  });
}

export function createChatToolActions({
  ui,
  store,
  derived
}: CreateChatToolActionsArgs) {
  const activeConversation = toActiveConversationCollaborator(derived.activeConversation);
  const activeConversationSession = toActiveConversationCollaboratorSession(derived.activeConversation);
  const addRuntimeToolMessage = createAddRuntimeToolMessage(store.chat, {
    resolveSpeakerCollaboratorId: (conversationId) =>
      store.chat.findConversation(conversationId)?.kind === 'group'
        ? derived.activeCollaboratorSourceId
        : null
  });
  const memoryActions = createDisabledLegacyMemoryActions(ui);

  const { runToolAction, runAssistantToolActions, applyToolPreview, saveToolPreview, rollbackToolPreview } = createToolActionRunner({
    local: {
      setCommandStatus: ui.setCommandStatus
    },
    chat: store.chat,
    persona: store.persona,
    collection: store.collection,
    runtime: store.runtime,
    space: store.space,
    derived: {
      activeConversation: derived.activeConversation,
      activeCollaboratorSourceId: derived.activeCollaboratorSourceId,
      codeCardActionModeByMessageId: derived.codeCardActionModeByMessageId
    },
    memoryActions,
    addRuntimeToolMessage
  });
  const { openCodeCollection, saveMessageCodeCard, handleCodeCardAction } = createChatCodeCardActions({
    local: {
      setCommandStatus: ui.setCommandStatus
    },
    chat: store.chat,
    collection: store.collection,
    space: store.space,
    derived: {
      activeConversation: activeConversationSession,
      activeCollaboratorSourceId: derived.activeCollaboratorSourceId,
      codeCardActionModeByMessageId: derived.codeCardActionModeByMessageId
    },
    frontstageCollaboratorId: store.space.frontstageCollaboratorId,
    addRuntimeToolMessage
  });
  const { saveMessageImageCard } = createChatImageAssetActions({
    local: {
      setCommandStatus: ui.setCommandStatus
    },
    collection: store.collection,
    frontstageCollaboratorId: store.space.frontstageCollaboratorId,
    activeConversation
  });

  let parseToolCommandPromise: Promise<typeof import('../../engines/toolExecutorCommands')> | null = null;

  const submitToolAction = (action: ToolAction) => {
    const session = ensureConversationSession(
      {
        activeConversation: derived.activeConversation,
        activeCollaboratorId: store.persona.activeCollaboratorId,
        personas: store.persona.personas
      },
      {
        createConversation: store.chat.createConversation
      }
    );
    if (!session) {
      ui.setCommandStatus('当前没有可用协作者，先新建一个协作者再执行工具。', true);
      return;
    }
    void runToolAction(session.conversationId, action, false).catch((error) => {
      const message = error instanceof Error ? error.message : '工具执行失败';
      ui.setCommandStatus(`工具执行失败：${message}`, true);
    });
  };

  const submitLocalToolCommand = (command: LocalToolCommand) => {
    switch (command.kind) {
      case 'exitWorkspace': {
        const conversationId = derived.activeConversation?.id;
        const activeProjectId = derived.activeConversation?.activeProjectId ?? null;
        if (!conversationId || !activeProjectId) {
          ui.setCommandStatus('当前对话没有绑定工作区');
          return;
        }
        store.chat.setConversationActiveProject(conversationId, null);
        ui.setCommandStatus('已退出当前工作区');
        return;
      }
      case 'openProviderSettings':
        if (!ui.openProviderSettings) {
          ui.setCommandStatus('当前入口不能打开模型设置，请从聊天输入框执行。', true);
          return;
        }
        ui.openProviderSettings();
        ui.setCommandStatus('已打开模型和供应商设置');
        return;
      default:
        ui.setCommandStatus('这个快捷指令需要从当前聊天输入框执行。', true);
        return;
    }
  };

  const submitToolCommand = async (rawInput: string) => {
    parseToolCommandPromise ??= import('../../engines/toolExecutorCommands');
    const { parseToolCommand } = await parseToolCommandPromise;
    const result = parseToolCommand(rawInput);

    if (!result) return false;
    if (!result.ok) {
      ui.setCommandStatus(`命令错误：${result.error}`, true);
      return true;
    }

    if ('action' in result) {
      submitToolAction(result.action);
      return true;
    }

    submitLocalToolCommand(result.command);
    return true;
  };

  const submitAssistantToolActions = async (
    conversationId: string,
    actions: ToolAction[],
    options?: AssistantToolActionBatchOptions
  ) => {
    const outcomes = await runAssistantToolActions(conversationId, actions, options);
    const assistantMessageId = options?.beforeMessageId;
    if (assistantMessageId) {
      const ombreReceipts = buildOmbreActivityReceipts(outcomes);
      if (ombreReceipts.length > 0) {
        const writable = store.chat.getConversationWritable(conversationId);
        const assistantMessage = writable?.messages.find((message) => message.id === assistantMessageId);
        if (writable && assistantMessage) {
          store.chat.updateMessage(writable, assistantMessageId, {
            activityReceipts: Array.from(new Set([...(assistantMessage.activityReceipts ?? []), ...ombreReceipts]))
          });
        }
      }
    }
    return outcomes;
  };

  return {
    submitToolAction,
    submitToolCommand,
    submitAssistantToolActions,
    applyToolPreview,
    saveToolPreview,
    rollbackToolPreview,
    openCodeCollection,
    saveMessageCodeCard,
    handleCodeCardAction,
    saveMessageImageCard
  };
}

export type ToolActions = ReturnType<typeof createChatToolActions>;
