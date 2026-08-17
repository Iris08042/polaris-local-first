import { requestAssistantReply } from '../../engines/chatApi';
import { resolvePersonaProviderBinding } from '../../engines/personaProviderBinding';
import { getDefaultProviderPath, inferProviderProtocol } from '../../engines/providerProtocol';
import type { AssistantRequestContext } from '../../engines/request/requestContext';
import { useChatStore } from '../../stores/chatStore';
import { usePersonaStore } from '../../stores/personaStore';
import { selectRuntimeApi, selectVisibleProviders, useRuntimeStore } from '../../stores/runtimeStore';
import {
  CONVERSATION_MEMORY_SUMMARY_VERSION,
  normalizeConversationRollingSummary,
  type ChatMessage,
  type Conversation,
  type ConversationSummaryModelSettings,
  type ConversationRollingSummary,
  type Persona,
  type ProviderProfile
} from '../../types/domain';

export const ROLLING_SUMMARY_TRIGGER_MESSAGE_COUNT = 50;
export const ROLLING_SUMMARY_RAW_CONTEXT_MESSAGE_COUNT = 200;
const ROLLING_SUMMARY_MAX_OUTPUT_TOKENS = '1600';
const ROLLING_SUMMARY_RECEIPT = '记忆摘要已更新';
const ROLLING_SUMMARY_FAILURE_RECEIPT = '记忆摘要更新失败';
const runningConversationIds = new Set<string>();

export const DEFAULT_MEMORY_SUMMARY_INSTRUCTION = `你负责维护一份“记忆摘要”，供后续对话理解长期背景与稳定关系使用。

输入包括：
1. 当前记忆摘要。它可能经过用户手动编辑，应视为权威底稿。
2. 本次新增的真实对话。

请将新增对话中长期有效的信息融入当前摘要，输出更新后的完整摘要，而不是修改说明或新增内容列表。

【应当保留】
- 明确表达、反复出现或经过长期交流确认的偏好、习惯、边界与雷区。
- 长期项目、持续目标、重要关注方向及仍然有效的计划。
- 对未来交流持续有帮助的个人背景、能力、需求与交流偏好。
- 双方稳定的相处方式、长期约定及已经明确形成的关系变化。
- 尚未结束、未来仍会继续影响对话的重要事项。
- 一次事件背后已经明确表现出的长期意义，但不要保留事件流水本身。

【不应保留】
- 今天或昨天发生了什么之类的日常流水。
- 天气、通勤、吃饭、睡觉、临时位置、即时安排等短期状态。
- 已经结束且不会持续影响未来交流的一次性事件。
- 单次情绪、随口表达、偶然偏好或未经确认的推测。
- 对用户或角色进行心理诊断、人格定型或过度概括。
- 聊天过程、逐句复述、工作日志和技术操作记录。
- 人物的基础角色设定、固定身份说明以及系统提示词本身。
- 模型自行提出但用户没有表达过的建议、目标和结论。

【更新原则】
- 当前摘要中已有且仍然有效的内容，应继续保留；不要因为本批对话没有再次提及就删除。
- 用户对摘要的手动编辑优先级最高。不要擅自恢复被用户删除的旧内容。
- 只有新增对话明确表明情况已经改变时，才修改或删除旧信息。
- 新旧信息冲突时，以更新、更明确、由用户直接表达的信息为准。
- 不要把临时状态提升为长期事实。
- 如果新增对话没有提供值得长期保留的信息，保持当前摘要不变，不要为了显得有更新而改写措辞。
- 合并重复内容，删除已经明确失效的内容，避免摘要无限膨胀。

【组织与表达】
- 根据实际内容自行组织简短小标题。
- 小标题不是固定栏目，可以随内容变化自由新增、删除、合并、拆分或改名。
- 不要为了维持版式而创建空栏目；内容较少时可以不使用小标题。
- 使用清晰、自然、克制的中文，保持高信息密度。
- 优先记录稳定性质和长期意义，不写成故事、日记或时间线。
- 尽量控制在 1600 个汉字以内；信息较少时应明显更短。
- 只输出更新后的摘要正文，不输出分析过程、修改说明、前言、JSON 或代码块。`;

export function resolveMemorySummary(summary: ConversationRollingSummary | null | undefined) {
  return normalizeConversationRollingSummary(summary);
}

export function resolveMemorySummaryInstruction(summary: ConversationRollingSummary | null | undefined) {
  return resolveMemorySummary(summary)?.instruction?.trim() || DEFAULT_MEMORY_SUMMARY_INSTRUCTION;
}

export function resolveRollingSummaryProvider(
  settings: ConversationSummaryModelSettings
): ProviderProfile | null {
  if (!settings.dedicatedProviderEnabled) return null;

  const protocol = inferProviderProtocol({
    protocol: settings.protocol,
    path: settings.path
  });
  const baseUrl = settings.baseUrl?.trim() ?? '';
  const path = settings.path?.trim() || getDefaultProviderPath(protocol);
  const apiKey = settings.apiKey?.trim() ?? '';
  const model = settings.modelOverride?.trim() ?? '';
  if (!baseUrl || !apiKey || !model) {
    throw new Error('请先在记忆摘要页填写独立线路的 Base URL、API Key 和模型。');
  }

  return {
    id: 'provider-rolling-summary',
    name: '记忆摘要',
    protocol,
    baseUrl,
    path,
    apiKey,
    model,
    capabilities: {
      images: false,
      streaming: false,
      thinking: false
    }
  };
}

async function appendRollingSummaryReceipt(conversationId: string, messageId: string | null, receipt: string) {
  if (!messageId) return;
  const writable = useChatStore.getState().getConversationWritable(conversationId);
  const assistant = writable?.messages.find((message) => message.id === messageId);
  if (!assistant || assistant.role !== 'assistant' || assistant.toolInvocation || !writable) return;
  const receipts = Array.from(new Set([...(assistant.activityReceipts ?? []), receipt]));
  useChatStore.getState().updateMessage(writable, assistant.id, { activityReceipts: receipts });
  await useChatStore.getState().persistToDb();
}

export function resolveRollingSummaryReceiptMessageId(messages: ChatMessage[]) {
  return [...messages]
    .reverse()
    .find((message) => message.role === 'assistant'
      && !message.toolInvocation
      && (message.nativeToolCalls?.length ?? 0) === 0
      && Boolean(message.content.trim() || message.thinkingText?.trim()))?.id ?? null;
}

export function isRollingSummarySourceMessage(message: ChatMessage) {
  return (message.role === 'user' || message.role === 'assistant')
    && message.origin !== 'tool-runtime'
    && message.origin !== 'system-note'
    && !message.toolInvocation
    && (message.nativeToolCalls?.length ?? 0) === 0
    && Boolean(message.content.trim() || message.attachments?.length || message.cardReference);
}

export function resolveRollingSummarySource(conversation: Pick<Conversation, 'messages' | 'rollingSummary'>) {
  const visibleMessages = conversation.messages.filter(isRollingSummarySourceMessage);
  const rawBufferStart = Math.max(0, visibleMessages.length - ROLLING_SUMMARY_RAW_CONTEXT_MESSAGE_COUNT);
  const editableTurnReverseOffset = [...visibleMessages]
    .reverse()
    .findIndex((message) => message.role === 'user');
  const editableTurnStart = editableTurnReverseOffset >= 0
    ? visibleMessages.length - editableTurnReverseOffset - 1
    : -1;
  const stableMessages = editableTurnStart >= 0
    ? visibleMessages.slice(0, editableTurnStart)
    : visibleMessages;
  const summary = resolveMemorySummary(conversation.rollingSummary);
  const throughMessageId = summary?.throughMessageId;
  const previousIndex = throughMessageId
    ? stableMessages.findIndex((message) => message.id === throughMessageId)
    : -1;
  const unsummarizedMessages = stableMessages.slice(previousIndex + 1);
  return {
    unsummarizedMessages,
    latestEligibleMessage: unsummarizedMessages[unsummarizedMessages.length - 1] ?? null,
    bufferedMessages: visibleMessages.slice(rawBufferStart)
  };
}

function formatSourceMessages(messages: ChatMessage[], persona: Persona) {
  const userName = persona.userName.trim() || '用户';
  const assistantName = persona.name.trim() || '协作者';
  return messages.map((message) => {
    const content = [
      message.content.trim(),
      ...(message.attachments ?? []).map((attachment) => `附件：${attachment.name}`),
      ...(message.cardReference ? [`卡片：${message.cardReference.title}`] : [])
    ].filter(Boolean).join('\n');
    return `${message.role === 'user' ? userName : assistantName}：${content}`;
  }).join('\n');
}

export function buildRollingSummaryContext(args: {
  persona: Persona;
  previousSummary?: ConversationRollingSummary | null;
  messages: ChatMessage[];
}): AssistantRequestContext {
  const previousSummary = resolveMemorySummary(args.previousSummary);
  const previous = previousSummary?.content.trim();
  return {
    memorySlots: { session: [], profile: [], pin: [] },
    attachmentSlots: { enabled: false, pending: [] },
    toolChoice: 'none',
    segments: [
      {
        kind: 'system',
        messages: [{
          role: 'system',
          content: resolveMemorySummaryInstruction(previousSummary)
        }]
      },
      {
        kind: 'conversation',
        messages: [{
          role: 'user',
          content: [
            previous ? `当前记忆摘要：\n${previous}` : '当前记忆摘要：（尚无）',
            '',
            '本次新增的真实对话：',
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
  const receiptMessageId = resolveRollingSummaryReceiptMessageId(conversation.messages);
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
    const summaryApi = resolveRollingSummaryProvider(runtime.conversationSummaryModel) ?? providerBinding.api;
    const reply = await requestAssistantReply({
      api: summaryApi,
      context: buildRollingSummaryContext({
        persona,
        previousSummary: resolveMemorySummary(conversation.rollingSummary),
        messages: source.unsummarizedMessages
      }),
      advanced: {
        ...persona.advanced,
        providerId: summaryApi.id,
        modelOverride: summaryApi.model,
        temperature: '0.2',
        maxTokens: ROLLING_SUMMARY_MAX_OUTPUT_TOKENS,
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
    if (!content) throw new Error('记忆摘要模型返回了空内容');
    const previousSummary = resolveMemorySummary(conversation.rollingSummary);
    const summary = {
      version: CONVERSATION_MEMORY_SUMMARY_VERSION,
      content,
      throughMessageId: source.latestEligibleMessage.id,
      updatedAt: Date.now(),
      instruction: resolveMemorySummaryInstruction(previousSummary)
    } satisfies ConversationRollingSummary;
    const chat = useChatStore.getState();
    const storedPreviousSummary = conversation.rollingSummary;
    chat.setConversationRollingSummary(conversationId, summary);
    try {
      await chat.persistToDb();
    } catch (error) {
      useChatStore.getState().setConversationRollingSummary(conversationId, storedPreviousSummary);
      throw error;
    }
    try {
      await appendRollingSummaryReceipt(conversationId, receiptMessageId, ROLLING_SUMMARY_RECEIPT);
    } catch (error) {
      console.warn('[rolling-summary] summary saved but receipt persistence failed', error);
    }
    return { status: 'updated', summary, messageCount: source.unsummarizedMessages.length };
  } catch (error) {
    try {
      await appendRollingSummaryReceipt(conversationId, receiptMessageId, ROLLING_SUMMARY_FAILURE_RECEIPT);
    } catch (receiptError) {
      console.warn('[rolling-summary] failure receipt persistence failed', receiptError);
    }
    throw error;
  } finally {
    runningConversationIds.delete(conversationId);
  }
}
