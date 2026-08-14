import { describe, expect, it } from 'vitest';
import { shouldShowWorldSwitchVeil } from './worldSwitchVeilVisibility';

describe('shouldShowWorldSwitchVeil', () => {
  it('keeps the world switch handle between chat and collection', () => {
    expect(shouldShowWorldSwitchVeil('chat')).toBe(true);
    expect(shouldShowWorldSwitchVeil('collection')).toBe(true);
  });
});
