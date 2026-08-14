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

  it('cannot reactivate legacy vector recall from imported settings', () => {
    expect(normalizeMemoryVectorRetrievalSettings({ enabled: true })).toEqual(
      expect.objectContaining({ enabled: false })
    );
  });
});
