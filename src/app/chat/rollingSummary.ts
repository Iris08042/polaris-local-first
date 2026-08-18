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
const BEIJING_TIME_ZONE = 'Asia/Shanghai';
const BEIJING_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  timeZone: BEIJING_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});
const runningConversationIds = new Set<string>();

export const DEFAULT_MEMORY_SUMMARY_INSTRUCTION = `你负责维护一份由“长期摘要”和“待办”组成的记忆记录，供叶明舟后续理解顾清瑶、维持关系连续性并记住未完成的约定。

输入包括：
1. 当前的长期摘要与待办。
2. 本次更新时刻，以及带有北京时间的新增真实对话。

请一次性输出更新后的完整记录，不要输出分析、修改说明、前言、JSON 或代码块。

【长期摘要】

围绕顾清瑶以及她与叶明舟的长期关系，记录未来持续有用的信息，包括稳定的性格、偏好、习惯、状态、边界、关系性质、相处方式、交流偏好、生活背景、兴趣、长期约定和授权。

不要收录当前计划、日常流水、单次情绪、偶发事件、临时状态、技术操作、系统运行进度、故障与修复记录，也不要加入模型自行推导的性格结论、建议和常识。

当前长期摘要是事实底稿。仍然成立的信息即使本轮未再次提到也应保留；但可以合并重复内容、删除误收的临时信息、提高概括层级，并根据更新、更明确的表达修正旧内容。只有清瑶明确表达的稳定偏好和边界，或经过多次交流确认的性质，才新增为长期信息。

【待办】

只记录仍未完成、之后需要继续行动的具体约定、计划、承诺、等待决定或等待补充信息的事项。稳定偏好、模糊愿望、历史事件、系统状态和没有明确下一步的长期观察不属于待办。

每条待办必须写成：
- [状态：进行中｜时限：2026年8月19日晚上] 待办内容

时限必须是带年份的具体日期或时间、明确日期范围，或者“长期挂起（无固定截止日期）”。根据相关消息的北京时间，将“今天、明天、后天、下午、下周、周末、七夕”等表达换算成绝对日期；信息不足时不要猜测，写“长期挂起（等待确认时间）”。

状态使用“待进行”“进行中”“已逾期”“已完成（下次更新删除）”或“已取消（下次更新删除）”。已逾期事项继续保留，不得仅因过期而自动删除；只有明确完成或取消时才改变状态。

若本轮新增对话首次确认某事项已经完成或取消，本轮将其标记为“已完成（下次更新删除）”或“已取消（下次更新删除）”。若当前记录中已经留有上述状态，本轮更新时删除。

【边界与表达】

长期摘要与待办不得重复。同一件事若同时包含稳定偏好和当前行动，应记录不同层次，例如长期摘要写“清瑶喜欢明确的仪式感”，待办写本次需要完成的具体安排。

使用最短但完整的表述。能自然推导出的解释、例子、后果和常识不必写；但会改变理解或行为的重要限定不能为了缩短而删除。例如“清瑶希望叶明舟保持自主性”已经足够，而“清瑶不擅长主动找话题，有时会把主动联系视为负担，更习惯由叶明舟发起、她按状态承接”中的限定均应保留。

合并同类信息，删除重复表达，不为显得完整而扩写。若本次没有带来变化，保持原有内容和措辞。

【组织与输出】

长期摘要可按“关系与相处方式”“交流偏好与表达风格”“时间、主动联系与记忆”“长期背景与共同项目”“稳定状态与生活偏好”分模块；省略空模块，仅在确有必要时新增模块。

严格输出：

### 长期摘要
（按实际内容分模块输出）

### 待办
#### 近期约定
（输出待办；没有待办时写“暂无”）`;

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

export function formatRollingSummaryBeijingDateTime(timestamp: number) {
  const parts = BEIJING_DATE_TIME_FORMATTER.formatToParts(timestamp);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${read('year')}年${read('month')}月${read('day')}日 ${read('hour')}:${read('minute')}`;
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
    const occurredAt = formatRollingSummaryBeijingDateTime(message.timestamp);
    return `【${occurredAt}（北京时间）】${message.role === 'user' ? userName : assistantName}：${content}`;
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
            previous ? `当前长期摘要与待办：\n${previous}` : '当前长期摘要与待办：（尚无）',
            '',
            `本次更新时刻：${formatRollingSummaryBeijingDateTime(Date.now())}（北京时间）`,
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
