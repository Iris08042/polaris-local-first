import { describe, expect, it } from 'vitest';
import { normalizeConversationSummaryModelSettings } from './runtimeStoreConversationSummary';
import { normalizeMemoryVectorRetrievalSettings } from './runtimeStoreMemoryRetrieval';

describe('retired memory runtime settings', () => {
  it('cannot reactivate the legacy conversation summary from imported settings', () => {
    expect(normalizeConversationSummaryModelSettings({
      enabled: true,
      autoUpdateEnabled: true
    })).toEqual(expect.objectContaining({
      enabled: false,
      autoUpdateEnabled: false
    }));
  });

  it('preserves the independent rolling-summary provider without reactivating legacy recall', () => {
    expect(normalizeConversationSummaryModelSettings({
      enabled: true,
      dedicatedProviderEnabled: true,
      protocol: 'gemini-generate-content',
      baseUrl: ' https://generativelanguage.googleapis.com/v1beta ',
      apiKey: ' summary-key ',
      modelOverride: ' gemini-2.5-flash '
    })).toEqual(expect.objectContaining({
      enabled: false,
      dedicatedProviderEnabled: true,
      protocol: 'gemini-generate-content',
      path: '/models/{model}:generateContent',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      apiKey: 'summary-key',
      modelOverride: 'gemini-2.5-flash'
    }));
  });

  it('cannot reactivate legacy vector recall from imported settings', () => {
    expect(normalizeMemoryVectorRetrievalSettings({ enabled: true })).toEqual(
      expect.objectContaining({ enabled: false })
    );
  });
});
