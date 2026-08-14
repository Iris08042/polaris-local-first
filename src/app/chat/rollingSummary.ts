import { requestAssistantReply } from '../../engines/chatApi';
import { resolvePersonaProviderBinding } from '../../engines/personaProviderBinding';
import type { AssistantRequestContext } from '../../engines/request/requestContext';
import { useChatStore } from '../../stores/chatStore';
import { usePersonaStore } from '../../stores/personaStore';
import { selectRuntimeApi, selectVisibleProviders, useRuntimeStore } from '../../stores/runtimeStore';
import type { ChatMessage, Conversation, ConversationRollingSummary, Persona } from '../../types/domain';

export const ROLLING_SUMMARY_TRIGGER_MESSAGE_COUNT = 50;
const ROLLING_SUMMARY_RECEIPT = '滚动摘要已更新';
const ROLLING_SUMMARY_FAILURE_RECEIPT = '滚动摘要更新失败';
const runningConversationIds = new Set<string>();

function appendRollingSummaryReceipt(conversationId: string, receipt: string) {
  const latestConversation = useChatStore.getState().conversations.find((item) => item.id === conversationId);
  const latestAssistant = [...(latestConversation?.messages ?? [])]
    .reverse()
    .find((message) => message.role === 'assistant' && !message.toolInvocation);
  const writable = useChatStore.getState().getConversationWritable(conversationId);
  if (!latestAssistant || !writable) return;
  const receipts = Array.from(new Set([...(latestAssistant.activityReceipts ?? []), receipt]));
  useChatStore.getState().updateMessage(writable, latestAssistant.id, { activityReceipts: receipts });
}

export function isRollingSummarySourceMessage(message: ChatMessage) {
  return (message.role === 'user' || message.role === 'assistant')
    && message.origin !== 'tool-runtime'
    && message.origin !== 'system-note'
    && !message.toolInvocation
    && Boolean(message.content.trim());
}

export function resolveRollingSummarySource(conversation: Pick<Conversation, 'messages' | 'rollingSummary'>) {
  const visibleMessages = conversation.messages.filter(isRollingSummarySourceMessage);
  let lastUserIndex = -1;
  for (let index = visibleMessages.length - 1; index >= 0; index -= 1) {
    if (visibleMessages[index]?.role === 'user') {
      lastUserIndex = index;
      break;
    }
  }
  const immutableMessages = lastUserIndex > 0 ? visibleMessages.slice(0, lastUserIndex) : [];
  const throughMessageId = conversation.rollingSummary?.throughMessageId;
  const previousIndex = throughMessageId
    ? immutableMessages.findIndex((message) => message.id === throughMessageId)
    : -1;
  const unsummarizedMessages = immutableMessages.slice(previousIndex + 1);
  return {
    immutableMessages,
    unsummarizedMessages,
    latestEligibleMessage: unsummarizedMessages[unsummarizedMessages.length - 1] ?? null,
    bufferedMessages: lastUserIndex >= 0 ? visibleMessages.slice(lastUserIndex) : visibleMessages
  };
}

function formatSourceMessages(messages: ChatMessage[], persona: Persona) {
  const userName = persona.userName.trim() || '用户';
  const assistantName = persona.name.trim() || '协作者';
  return messages.map((message) => `${message.role === 'user' ? userName : assistantName}：${message.content.trim()}`).join('\n');
}

export function buildRollingSummaryContext(args: {
  persona: Persona;
  previousSummary?: ConversationRollingSummary | null;
  messages: ChatMessage[];
}): AssistantRequestContext {
  const previous = args.previousSummary?.content.trim();
  return {
    memorySlots: { session: [], profile: [], pin: [] },
    attachmentSlots: { enabled: false, pending: [] },
    toolChoice: 'none',
    segments: [
      {
        kind: 'system',
        messages: [{
          role: 'system',
          content: [
            '把旧滚动摘要与新增对话融合成一份新的滚动摘要。',
            '它只负责让下一轮自然接上当前聊天：保留近期事件、正在进行的话题、未完成事项、双方当下态度和已经发生的转折。',
            '不要写角色设定，不要把临时情绪固化成人格，不要补充来源里没有的事实，不要逐句复述。',
            '直接输出简洁中文正文，不要标题、列表说明、JSON 或分析过程。'
          ].join('\n')
        }]
      },
      {
        kind: 'conversation',
        messages: [{
          role: 'user',
          content: [
            previous ? `旧滚动摘要：\n${previous}` : '旧滚动摘要：（尚无）',
            '',
            '新增且已经不可编辑的对话：',
            formatSourceMessages(args.messages, args.persona)
          ].join('\n')
        }]
      }
    ]
  };
}

export type RollingSummaryRunResult =
  | { status: 'updated'; summary: ConversationRollingSummary; messageCount: number }
  | { status: 'up_to_date'; messageCount: 0 }
  | { status: 'below_threshold'; messageCount: number };

export async function updateRollingSummaryForConversation(
  conversationId: string,
  options: { force?: boolean } = {}
): Promise<RollingSummaryRunResult> {
  if (runningConversationIds.has(conversationId)) return { status: 'below_threshold', messageCount: 0 };
  const conversation = useChatStore.getState().conversations.find((item) => item.id === conversationId);
  if (!conversation?.collaboratorId || conversation.kind === 'group') return { status: 'up_to_date', messageCount: 0 };
  const persona = usePersonaStore.getState().personas.find((item) => item.id === conversation.collaboratorId);
  if (!persona) return { status: 'up_to_date', messageCount: 0 };
  const source = resolveRollingSummarySource(conversation);
  if (!source.latestEligibleMessage) return { status: 'up_to_date', messageCount: 0 };
  if (!options.force && source.unsummarizedMessages.length < ROLLING_SUMMARY_TRIGGER_MESSAGE_COUNT) {
    return { status: 'below_threshold', messageCount: source.unsummarizedMessages.length };
  }

  runningConversationIds.add(conversationId);
  try {
    const runtime = useRuntimeStore.getState();
    const providerBinding = resolvePersonaProviderBinding({
      globalApi: selectRuntimeApi(runtime),
      providers: selectVisibleProviders(runtime),
      persona
    });
    const reply = await requestAssistantReply({
      api: providerBinding.api,
      context: buildRollingSummaryContext({
        persona,
        previousSummary: conversation.rollingSummary,
        messages: source.unsummarizedMessages
      }),
      advanced: {
        ...persona.advanced,
        providerId: providerBinding.api.id,
        modelOverride: providerBinding.api.model,
        temperature: '0.2',
        showThinking: false,
        streaming: false,
        customHeaders: '',
        customBody: '',
        regexRules: '',
        regexTriggers: '',
        snippets: []
      },
      sessionId: conversationId
    });
    const content = reply.content.trim();
    if (!content) throw new Error('滚动摘要模型返回了空内容');
    const summary = {
      content,
      throughMessageId: source.latestEligibleMessage.id,
      updatedAt: Date.now()
    } satisfies ConversationRollingSummary;
    const chat = useChatStore.getState();
    chat.setConversationRollingSummary(conversationId, summary);
    appendRollingSummaryReceipt(conversationId, ROLLING_SUMMARY_RECEIPT);
    return { status: 'updated', summary, messageCount: source.unsummarizedMessages.length };
  } catch (error) {
    appendRollingSummaryReceipt(conversationId, ROLLING_SUMMARY_FAILURE_RECEIPT);
    throw error;
  } finally {
    runningConversationIds.delete(conversationId);
  }
}
