import { DEFAULT_CONVERSATION_SUMMARY_SOURCE_CHARS } from '../engines/conversationSummaryMemory';
import { getDefaultProviderPath, inferProviderProtocol } from '../engines/providerProtocol';
import type { ConversationSummaryModelSettings } from '../types/domain';

export const DEFAULT_CONVERSATION_SUMMARY_MODEL_SETTINGS: ConversationSummaryModelSettings = {
  enabled: false,
  autoUpdateEnabled: false,
  providerId: '',
  dedicatedProviderEnabled: false,
  protocol: 'openai-completions',
  baseUrl: '',
  path: '/chat/completions',
  apiKey: '',
  modelOverride: '',
  targetSourceChars: DEFAULT_CONVERSATION_SUMMARY_SOURCE_CHARS,
  skipProcessedSources: true,
  lastUpdatedAt: 0
};

export function normalizeConversationSummaryModelSettings(
  value?: Partial<ConversationSummaryModelSettings> | null
): ConversationSummaryModelSettings {
  const rawTargetChars = value?.targetSourceChars;
  const targetSourceChars =
    typeof rawTargetChars === 'number' && Number.isFinite(rawTargetChars) && rawTargetChars >= 1
      ? Math.floor(rawTargetChars)
      : DEFAULT_CONVERSATION_SUMMARY_SOURCE_CHARS;
  const rawLastUpdatedAt = value?.lastUpdatedAt;
  const protocol = inferProviderProtocol({
    protocol: value?.protocol,
    path: value?.path
  });

  return {
    enabled: false,
    autoUpdateEnabled: false,
    providerId: value?.providerId?.trim() ?? '',
    dedicatedProviderEnabled: value?.dedicatedProviderEnabled === true,
    protocol,
    baseUrl: value?.baseUrl?.trim() ?? '',
    path: value?.path?.trim() || getDefaultProviderPath(protocol),
    apiKey: value?.apiKey?.trim() ?? '',
    modelOverride: value?.modelOverride?.trim() ?? '',
    targetSourceChars,
    skipProcessedSources: value?.skipProcessedSources !== false,
    lastUpdatedAt:
      typeof rawLastUpdatedAt === 'number' && Number.isFinite(rawLastUpdatedAt) && rawLastUpdatedAt >= 0
        ? Math.floor(rawLastUpdatedAt)
        : 0
  };
}
