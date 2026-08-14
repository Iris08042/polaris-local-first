import type { AssistantToolContext } from '../assistantToolProtocol';
import { getAssetBlob } from '../../infrastructure/assetStore';
import {
  requestImageUnderstanding,
  resolveImageUnderstandingProvider,
  resolveProviderImageUnderstandingSettings,
  type ImageUnderstandingRequestReply
} from '../imageUnderstandingClient';
import { createUid } from '../id';
import { buildRequestContextPlan } from './requestContextPlan';
import type { AssistantRequestAudit } from './requestAudit';
import { assembleAssistantContext, type AssistantRequestContext } from './requestContext';
import { resolveRequestCachePlan } from './requestCachePlan';
import { buildRequestContextReceipt } from './requestContextReceipt';
import { resolveRequestBudgetPlan, resolveRequestBudgetUsage, resolveRequestHistoryBudget } from './requestBudget';
import { resolveRequestMemoryPlan } from './requestMemoryPlan';
import { resolveRequestConversationSummaryPlan } from './requestConversationSummaryPlan';
import {
  resolveRequestSemanticRecallPlan,
  resolveSemanticRecallContextCandidates
} from './requestSemanticRecallPlan';
import type { RequestSemanticVectorEmbeddingClient } from './requestSemanticVectorRecall';
import { buildAssistantPromptParts } from './requestPromptLayers';
import { selectPromptPartsForBudget } from './requestTruncation';
import { buildTemplateContext } from '../templateEngine';
import { resolvePersonaPromptForRuntimeSpec } from '../promptCompiler';
import {
  resolveProviderCapability,
  resolveCanonicalProviderCapabilities,
  resolveProviderRuntimeContextTokenBudget,
  type CanonicalProviderCapabilitySet
} from '../provider-runtime';
import type {
  ChatMessage,
  Conversation,
  ConversationRollingSummary,
  ConversationTaskState,
  ImageUnderstandingSettings,
  MemoryVectorRetrievalSettings,
  Persona,
  ProviderProfile,
  ToolLedgerEntry
} from '../../types/domain';
import { prepareConversationMessages } from './requestConversationPreparation';
import {
  buildRequestAudit,
  buildRequestTooling
} from './requestPreparationAudit';
import type { RequestMessage } from './requestMessage';

const DEFAULT_CONTEXT_MESSAGE_LIMIT = Number.MAX_SAFE_INTEGER;
const UNBOUNDED_CONTEXT_TOKEN_BUDGET = Number.MAX_SAFE_INTEGER;
const REQUEST_IMAGE_MAX_EDGE = 1280;
const REQUEST_IMAGE_SOFT_TARGET_BYTES = 320 * 1024;
const REQUEST_IMAGE_EXPORT_QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52, 0.42] as const;
const REQUEST_IMAGE_HYDRATION_MAX_USER_TURNS = 2;
const REQUEST_IMAGE_DIRECT_KEEP_MIME_TYPES = new Set(['image/jpeg', 'image/webp']);
const MINIMUM_RAW_CONTEXT_MESSAGE_COUNT = 300;

export type RequestImageUnderstandingResult = {
  messageId: string;
  attachmentId: string;
  textContent: string;
};
function parseContextLimit(input: string | undefined): number {
  const trimmed = input?.trim();
  if (!trimmed) return DEFAULT_CONTEXT_MESSAGE_LIMIT;

  const limit = Number(trimmed);
  if (!Number.isFinite(limit) || limit < 1) {
    return DEFAULT_CONTEXT_MESSAGE_LIMIT;
  }

  return Math.floor(limit);
}

export function resolveMessagesAfterRollingSummary(
  messages: ChatMessage[],
  rollingSummary?: ConversationRollingSummary | null
) {
  const throughMessageId = rollingSummary?.throughMessageId;
  if (!throughMessageId) return messages;
  const throughIndex = messages.findIndex((message) => message.id === throughMessageId);
  return throughIndex >= 0 ? messages.slice(throughIndex + 1) : messages;
}

function formatRollingSummaryForRequest(summary?: ConversationRollingSummary | null) {
  const content = summary?.content.trim();
  if (!content) return [];
  return [
    [
      '滚动摘要（只用于自然衔接当前聊天，不要机械复述，也不要把临时状态当成固定人格；若与后面的原始对话冲突，以原始对话为准）：',
      content
    ].join('\n')
  ];
}

export function resolvePreparedAdvancedSettings(params: {
  advanced: Persona['advanced'] | undefined;
  toolContext?: AssistantToolContext;
}) {
  return params.advanced;
}

type ProviderRuntimePromptBudget = Pick<
  CanonicalProviderCapabilitySet['budgets'],
  'recommendedPromptTokens' | 'promptBudgetPolicy'
>;

export function resolveContextTokenBudget(providerBudgets: ProviderRuntimePromptBudget): number {
  return resolveProviderRuntimeContextTokenBudget(providerBudgets, UNBOUNDED_CONTEXT_TOKEN_BUDGET);
}

function buildConversationContext(args: {
  messages: ChatMessage[];
  persona: Persona | null | undefined;
  historyMaxTokens: number;
  messageLimit: number;
  historyMode: AssistantRequestAudit['contextPlan']['historyMode'];
}) {
  const conversationBuildStartedAt = runtimeNow();
  const preparedMessages = prepareConversationMessages(args.messages, args.persona);
  const conversationBuildMs = runtimeNow() - conversationBuildStartedAt;
  const contextPlanStartedAt = runtimeNow();
  const { conversation, contextPlan, historyDecision } = buildRequestContextPlan({
    messages: preparedMessages.messages,
    messagesPrepared: preparedMessages.transforms.orderNormalized,
    historyMaxTokens: args.historyMaxTokens,
    messageLimit: args.messageLimit,
    historyMode: args.historyMode
  });

  return {
    conversation,
    contextPlan,
    historyDecision,
    conversationBuildMs,
    contextPlanMs: runtimeNow() - contextPlanStartedAt
  };
}

function runtimeNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader === 'undefined') {
    const buffer = await blob.arrayBuffer();
    const base64 = typeof Buffer !== 'undefined'
      ? Buffer.from(buffer).toString('base64')
      : btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
  }

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('图片读取失败'));
    reader.readAsDataURL(blob);
  });
}

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement | null> {
  if (typeof Image === 'undefined' || typeof URL?.createObjectURL !== 'function') {
    return null;
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.decoding = 'async';
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('图片加载失败'));
      element.src = objectUrl;
    });
    return image;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function shouldKeepOriginalRequestImage(params: {
  blob: Blob;
  mimeType: string;
  scale: number;
}) {
  const { blob, mimeType, scale } = params;
  return (
    scale === 1
    && blob.size <= REQUEST_IMAGE_SOFT_TARGET_BYTES
    && REQUEST_IMAGE_DIRECT_KEEP_MIME_TYPES.has(mimeType)
  );
}

export async function buildRequestImageDataUrl(blob: Blob): Promise<string | null> {
  if (!blob.size) return null;

  const fallbackDataUrl = async () => await blobToDataUrl(blob);
  const mimeType = blob.type.toLowerCase();

  if (
    typeof document === 'undefined'
    || mimeType === 'image/svg+xml'
    || mimeType === 'image/gif'
  ) {
    return await fallbackDataUrl();
  }

  const image = await loadImageFromBlob(blob);
  if (!image) {
    return await fallbackDataUrl();
  }

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) {
    return await fallbackDataUrl();
  }

  const scale = Math.min(1, REQUEST_IMAGE_MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  if (shouldKeepOriginalRequestImage({ blob, mimeType, scale })) {
    return await fallbackDataUrl();
  }

  let canvas: HTMLCanvasElement;
  try {
    canvas = document.createElement('canvas');
  } catch {
    return await fallbackDataUrl();
  }
  canvas.width = width;
  canvas.height = height;

  let context: CanvasRenderingContext2D | null = null;
  try {
    context = canvas.getContext('2d');
  } catch {
    context = null;
  }
  if (!context) {
    return await fallbackDataUrl();
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let optimizedBlob: Blob | null = null;
  for (const quality of REQUEST_IMAGE_EXPORT_QUALITY_STEPS) {
    const candidate = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (!candidate) continue;
    optimizedBlob = candidate;
    if (candidate.size <= REQUEST_IMAGE_SOFT_TARGET_BYTES) break;
  }

  if (!optimizedBlob) {
    return await fallbackDataUrl();
  }

  if (scale === 1 && optimizedBlob.size >= blob.size) {
    return await fallbackDataUrl();
  }

  return await blobToDataUrl(optimizedBlob);
}

export function resolveRequestImageHydrationMessageIds(messages: RequestMessage[]): Set<string> {
  const hydrationMessageIds = new Set<string>();
  let remainingImageTurns = REQUEST_IMAGE_HYDRATION_MAX_USER_TURNS;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (remainingImageTurns <= 0) {
      break;
    }

    const message = messages[index];
    if (message.role !== 'user' || !messageContainsImage(message)) {
      continue;
    }

    hydrationMessageIds.add(message.id);
    remainingImageTurns -= 1;
  }

  return hydrationMessageIds;
}

export async function hydrateConversationAssets(messages: RequestMessage[]): Promise<RequestMessage[]> {
  if (!messages.some((message) => message.role === 'user' && messageContainsImage(message))) {
    return messages;
  }
  const hydratedDataUrlByAssetId = new Map<string, Promise<string | null>>();
  const hydrationMessageIds = resolveRequestImageHydrationMessageIds(messages);

  if (hydrationMessageIds.size === 0) {
    return messages;
  }

  return await Promise.all(
    messages.map(async (message) => {
      if (
        message.role !== 'user'
        || !hydrationMessageIds.has(message.id)
        || !message.attachments?.some((attachment) => attachment.kind === 'image' && !attachment.clearedAt)
      ) {
        return message;
      }

      let didHydrateImage = false;

      const attachments = await Promise.all(
        message.attachments.map(async (attachment) => {
          if (attachment.kind !== 'image' || attachment.clearedAt) return attachment;
          if (!attachment.assetId) {
            return attachment;
          }
          let dataUrl: string | null = null;
          try {
            const pending =
              hydratedDataUrlByAssetId.get(attachment.assetId)
              ?? (async () => {
                const blob = await getAssetBlob(attachment.assetId);
                if (!blob) return null;
                return await buildRequestImageDataUrl(blob);
              })();
            hydratedDataUrlByAssetId.set(attachment.assetId, pending);
            dataUrl = await pending;
          } catch (error) {
            console.warn(`[request] image hydration skipped for ${attachment.assetId}`, error);
            return attachment;
          }
          if (!dataUrl) return attachment;
          didHydrateImage = true;
          return { ...attachment, dataUrl };
        })
      );

      if (!didHydrateImage) {
        return message;
      }

      return {
        ...message,
        attachments
      };
    })
  );
}

export function messageContainsImage(message: Pick<RequestMessage, 'attachments'> | Pick<ChatMessage, 'attachments'> | undefined): boolean {
  return Boolean(message?.attachments?.some((attachment) => attachment.kind === 'image' && !attachment.clearedAt));
}

export function messageContainsUnreadableImage(message: Pick<RequestMessage, 'attachments'> | Pick<ChatMessage, 'attachments'> | undefined): boolean {
  return Boolean(message?.attachments?.some((attachment) =>
    attachment.kind === 'image'
    && !attachment.clearedAt
    && !attachment.textContent?.trim()
  ));
}

function resolveChatImageUnderstandingMessageIds(messages: ChatMessage[]): Set<string> {
  const hydrationMessageIds = new Set<string>();
  let remainingImageTurns = REQUEST_IMAGE_HYDRATION_MAX_USER_TURNS;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (remainingImageTurns <= 0) break;

    const message = messages[index];
    if (message.role !== 'user' || !messageContainsUnreadableImage(message)) continue;

    hydrationMessageIds.add(message.id);
    remainingImageTurns -= 1;
  }

  return hydrationMessageIds;
}

async function understandConversationImages(params: {
  messages: ChatMessage[];
  settings?: ImageUnderstandingSettings;
  providers?: ProviderProfile[];
  globalApi: ProviderProfile;
  signal?: AbortSignal;
  requestImageUnderstanding?: ImageUnderstandingRequestReply;
}): Promise<{
  messages: ChatMessage[];
  results: RequestImageUnderstandingResult[];
}> {
  const api = resolveImageUnderstandingProvider({
    settings: params.settings,
    providers: params.providers,
    globalApi: params.globalApi
  });
  if (!api) {
    return {
      messages: params.messages,
      results: []
    };
  }
  const providerCapability = resolveProviderCapability(api);
  if (providerCapability.input.images === 'none') {
    console.warn('[request] image understanding skipped because the selected provider does not support image input.');
    return {
      messages: params.messages,
      results: []
    };
  }

  const targetMessageIds = resolveChatImageUnderstandingMessageIds(params.messages);
  if (targetMessageIds.size === 0) {
    return {
      messages: params.messages,
      results: []
    };
  }

  const dataUrlByAssetId = new Map<string, Promise<string | null>>();
  const results: RequestImageUnderstandingResult[] = [];

  const messages = await Promise.all(params.messages.map(async (message) => {
    if (!targetMessageIds.has(message.id) || !message.attachments?.length) return message;

    let didUpdate = false;
    const attachments = await Promise.all(message.attachments.map(async (attachment) => {
      if (
        attachment.kind !== 'image'
        || attachment.clearedAt
        || attachment.textContent?.trim()
        || !attachment.assetId
      ) {
        return attachment;
      }

      try {
        const pending =
          dataUrlByAssetId.get(attachment.assetId)
          ?? (async () => {
            const blob = await getAssetBlob(attachment.assetId);
            if (!blob) return null;
            return await buildRequestImageDataUrl(blob);
          })();
        dataUrlByAssetId.set(attachment.assetId, pending);
        const imageDataUrl = await pending;
        if (!imageDataUrl) return attachment;

        const textContent = await requestImageUnderstanding({
          api,
          imageDataUrl,
          imageName: attachment.name,
          signal: params.signal,
          requestReply: params.requestImageUnderstanding
        });
        didUpdate = true;
        results.push({
          messageId: message.id,
          attachmentId: attachment.id,
          textContent
        });
        return {
          ...attachment,
          textContent
        };
      } catch (error) {
        if (params.signal?.aborted) throw error;
        console.warn(`[request] image understanding skipped for ${attachment.assetId}`, error);
        return attachment;
      }
    }));

    return didUpdate
      ? {
          ...message,
          attachments
        }
      : message;
  }));

  return {
    messages,
    results
  };
}

export async function prepareCollaboratorReplyRequest(params: {
  api: ProviderProfile;
  providers?: ProviderProfile[];
  globalApi?: ProviderProfile;
  memoryVectorRetrieval?: MemoryVectorRetrievalSettings;
  imageUnderstanding?: ImageUnderstandingSettings;
  persona: Persona | null | undefined;
  personas?: Persona[];
  messages: ChatMessage[];
  rollingSummary?: ConversationRollingSummary | null;
  semanticRecallEnabled?: boolean;
  semanticRecallConversations?: Conversation[];
  loadSemanticRecallConversations?: (conversationIds: string[]) => Promise<Conversation[]>;
  activeConversationId?: string | null;
  toolLedger?: ToolLedgerEntry[];
  toolContext?: AssistantToolContext;
  currentTask?: ConversationTaskState | null;
  nickname?: string;
  signal?: AbortSignal;
  requestVectorEmbeddings?: RequestSemanticVectorEmbeddingClient;
  requestImageUnderstanding?: ImageUnderstandingRequestReply;
}): Promise<{
  assistantName: string;
  modelId: string;
  context: AssistantRequestContext;
  advanced: Persona['advanced'] | undefined;
  audit: AssistantRequestAudit;
  conversation: RequestMessage[];
  imageUnderstandingResults: RequestImageUnderstandingResult[];
}> {
  const { api, persona, messages, toolLedger, toolContext, currentTask, nickname } = params;
  const startedAt = runtimeNow();
  const requestId = createUid('request');
  const preparedAdvanced = resolvePreparedAdvancedSettings({
    advanced: persona?.advanced,
    toolContext
  });
  const providerCapability = resolveProviderCapability(api, preparedAdvanced);
  const modelId = providerCapability.provider.model;
  const supportsImageInput = providerCapability.input.images !== 'none';
  const imageUnderstanding = !supportsImageInput
    ? await understandConversationImages({
        messages,
        settings: resolveProviderImageUnderstandingSettings({
          api
        }),
        providers: params.providers,
        globalApi: params.globalApi ?? api,
        signal: params.signal,
        requestImageUnderstanding: params.requestImageUnderstanding
      })
    : {
        messages,
        results: []
      };
  const requestSourceMessages = resolveMessagesAfterRollingSummary(
    imageUnderstanding.messages,
    params.rollingSummary
  );
  const assistantName = persona?.name || 'Assistant';
  const templateContext = buildTemplateContext({
    modelId,
    modelName: modelId,
    assistantName,
    nickname: nickname ?? persona?.userName
  });
  let stepStartedAt = runtimeNow();
  const personaPrompt = await resolvePersonaPromptForRuntimeSpec(persona);
  const personaPromptMs = runtimeNow() - stepStartedAt;
  const providerCapabilities = resolveCanonicalProviderCapabilities(api, preparedAdvanced);
  const toolProtocolMode = providerCapabilities.tools.promptProtocol;
  stepStartedAt = runtimeNow();
  const promptParts = buildAssistantPromptParts({
    personaPrompt: personaPrompt.prompt,
    personaPromptSource: personaPrompt.source,
    templateContext,
    regexTriggers: preparedAdvanced?.regexTriggers,
    includeRuntimeClockContext: persona?.systemTimeContextEnabled === true,
    promptInjections: providerCapability.promptInjections,
    toolContext,
    currentTask,
    toolProtocolMode,
    messages: requestSourceMessages
  });
  const promptPartsMs = runtimeNow() - stepStartedAt;
  const messageLimit = Math.max(
    MINIMUM_RAW_CONTEXT_MESSAGE_COUNT,
    parseContextLimit(preparedAdvanced?.contextMessageLimit)
  );
  const tokenBudget = resolveContextTokenBudget(providerCapabilities.budgets);
  const budgetPlan = resolveRequestBudgetPlan({
    messageLimit,
    totalPromptTokens: tokenBudget
  });
  stepStartedAt = runtimeNow();
  const { selectedPromptParts, promptPartDecisions } = selectPromptPartsForBudget({
    promptParts,
    plan: budgetPlan
  });
  const truncationMs = runtimeNow() - stepStartedAt;
  stepStartedAt = runtimeNow();
  const memoryPlan = resolveRequestMemoryPlan({
    memory: undefined,
    inheritedMemorySources: [],
    maxTokens: budgetPlan.buckets.memory.maxTokens
  });
  const memoryPlanMs = runtimeNow() - stepStartedAt;
  const semanticVectorCandidates: never[] = [];
  const conversationSummaryPlan = resolveRequestConversationSummaryPlan({
    enabled: false,
    summaries: undefined,
    maxTokens: null
  });
  const semanticRecallConversations: Conversation[] = [];
  const semanticRecallPlan = resolveRequestSemanticRecallPlan({
    enabled: false,
    messages: requestSourceMessages,
    conversations: semanticRecallConversations,
    activeConversationId: params.activeConversationId ?? null,
    currentCollaboratorId: persona?.id ?? null,
    maxTokens: null,
    vectorCandidates: semanticVectorCandidates
  });
  const semanticRecallCandidates = resolveSemanticRecallContextCandidates({
    plan: semanticRecallPlan,
    conversations: semanticRecallConversations
  });
  const historyMaxTokens = resolveRequestHistoryBudget({
    plan: budgetPlan,
    promptParts: selectedPromptParts,
    memoryPlan
  });
  const {
    conversation,
    contextPlan,
    historyDecision,
    conversationBuildMs,
    contextPlanMs
  } = buildConversationContext({
    messages: requestSourceMessages,
    persona,
    historyMaxTokens,
    messageLimit,
    historyMode: toolContext?.activeProject ? 'workspace' : 'conversation'
  });
  stepStartedAt = runtimeNow();
  const { toolRequest, tooling } = buildRequestTooling(toolContext, providerCapabilities);
  const toolRequestMs = runtimeNow() - stepStartedAt;
  const canReadWorkspaceReferenceDocs = Boolean(toolRequest.tools?.some((tool) =>
    tool.function.name === 'readWorkspaceReference'
    || tool.function.name === 'searchWorkspaceReferences'
    || tool.function.name === 'listWorkspaceReferences'
    || tool.function.name === 'searchReadableContext'
  ));
  stepStartedAt = runtimeNow();
  const cachePlan = resolveRequestCachePlan({
    promptParts: selectedPromptParts,
    providerCacheMode: providerCapabilities.cache.mode,
    providerSendsTopLevelCacheControl: providerCapability.cache.sendsTopLevelCacheControl,
    providerAutomaticMessageHistoryCache: providerCapability.cache.automaticMessageHistoryCache,
    modelId
  });
  const cachePlanMs = runtimeNow() - stepStartedAt;
  stepStartedAt = runtimeNow();
  const runtimeConversation = supportsImageInput
    ? await hydrateConversationAssets(conversation)
    : conversation;
  const assetHydrationMs = runtimeNow() - stepStartedAt;
  stepStartedAt = runtimeNow();
  const context = assembleAssistantContext({
    systemPromptParts: selectedPromptParts.map((part) => ({
      name: part.name,
      layer: part.layer,
      content: part.content
    })),
    messages: runtimeConversation,
    messagesPrepared: true,
    toolLedger,
    memoryLines: memoryPlan.selectedLines,
    conversationSummaries: conversationSummaryPlan.selectedSummaries,
    semanticRecallCandidates,
    memoryReferenceDocs: [],
    workspaceReferenceDocs: canReadWorkspaceReferenceDocs
      ? toolContext?.visibleWorkspaceReferenceDocs?.filter((doc) =>
          !toolContext.activeProject?.id || doc.projectId === toolContext.activeProject.id
        ) ?? []
      : [],
    historySummaries: formatRollingSummaryForRequest(params.rollingSummary),
    allowImages: supportsImageInput,
    toolContext,
    tools: toolRequest.tools,
    toolChoice: toolRequest.toolChoice,
    cachePlan
  });
  const contextAssemblyMs = runtimeNow() - stepStartedAt;
  stepStartedAt = runtimeNow();
  const budgetUsage = resolveRequestBudgetUsage({
    plan: budgetPlan,
    promptParts: selectedPromptParts,
    memoryPlan,
    conversation,
    context,
    toolContext
  });
  const budgetUsageMs = runtimeNow() - stepStartedAt;
  const requestReceipt = buildRequestContextReceipt({
    selectedPromptParts,
    context,
    contextPlan,
    memoryPlan,
    conversationSummaryPlan,
    semanticRecallPlan,
    cachePlan,
    tooling
  });
  const totalPreparationMs = runtimeNow() - startedAt;

  return {
    assistantName,
    modelId,
    context,
    advanced: preparedAdvanced,
    conversation: runtimeConversation,
    imageUnderstandingResults: imageUnderstanding.results,
    audit: buildRequestAudit({
      requestId,
      assistantName,
      providerId: api.id,
      providerName: api.name,
      modelId,
      persona,
      personaPromptSource: personaPrompt.source,
      messageLimit,
      tokenBudget,
      budgetPlan,
      budgetUsage,
      memoryPlan,
      conversationSummaryPlan,
      semanticRecallPlan,
      semanticRecallContextCandidates: semanticRecallCandidates,
      cachePlan,
      contextPlan,
      sourceMessages: requestSourceMessages,
      conversation,
      promptParts,
      truncation: {
        promptParts: promptPartDecisions,
        history: historyDecision
      },
      tooling,
      requestReceipt,
      context,
      timings: {
        personaPromptMs: Math.round(personaPromptMs),
        promptPartsMs: Math.round(promptPartsMs),
        truncationMs: Math.round(truncationMs),
        memoryPlanMs: Math.round(memoryPlanMs),
        conversationBuildMs: Math.round(conversationBuildMs),
        contextPlanMs: Math.round(contextPlanMs),
        toolRequestMs: Math.round(toolRequestMs),
        cachePlanMs: Math.round(cachePlanMs),
        assetHydrationMs: Math.round(assetHydrationMs),
        contextAssemblyMs: Math.round(contextAssemblyMs),
        budgetUsageMs: Math.round(budgetUsageMs),
        totalPreparationMs: Math.round(totalPreparationMs)
      }
    })
  };
}
