import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APP_CUSTOMIZATION,
  mergeAppCustomizationPatch,
  normalizeAppCustomization
} from './runtimeStoreCustomization';

describe('normalizeAppCustomization', () => {
  it('falls back to the default cosmetic settings', () => {
    expect(normalizeAppCustomization()).toEqual(DEFAULT_APP_CUSTOMIZATION);
  });

  it('clamps background controls into the supported range', () => {
    expect(normalizeAppCustomization({
      backgroundOpacity: 9,
      backgroundDim: -1,
      backgroundBlur: 99,
      starColor: '#FD9',
      starOpacity: 9,
      starGlow: -1,
      starScale: 9,
      starWarmth: 2,
      customFontAssetIds: [' asset-font ', '', 'asset-font', 'asset-serif'],
      customFontScopeAssignments: {
        global: 'asset-serif',
        titles: 'asset-font',
        chat: 'missing-font',
        cards: ' asset-serif '
      },
      relationshipStartDate: 'not-a-date',
      coupleImageAssetId: ' couple-photo ',
      coupleImagePositionX: -8,
      coupleImagePositionY: 140,
      coupleImageScale: 9,
      backgroundFit: 'weird' as 'cover'
    })).toEqual({
      ...DEFAULT_APP_CUSTOMIZATION,
      starColor: '#ffdd99',
      starOpacity: 1,
      starGlow: 0,
      starScale: 1.18,
      starWarmth: 1,
      backgroundOpacity: 0.82,
      backgroundDim: 0,
      backgroundBlur: 28,
      customFontAssetIds: ['asset-font', 'asset-serif'],
      customFontScopeAssignments: {
        global: 'asset-serif',
        titles: 'asset-font',
        chat: null,
        cards: 'asset-serif'
      },
      relationshipStartDate: '',
      coupleImageAssetId: 'couple-photo',
      coupleImagePositionX: 0,
      coupleImagePositionY: 100,
      coupleImageScale: 2.4,
      backgroundFit: 'cover'
    });
  });
});

describe('mergeAppCustomizationPatch', () => {
  it('keeps existing cosmetic state while applying a focused patch', () => {
    expect(mergeAppCustomizationPatch(DEFAULT_APP_CUSTOMIZATION, {
      showChatAvatars: true,
      starColor: '#d6a4ff',
      starOpacity: 0.62,
      starGlow: 0.8,
      starScale: 1.12,
      starWarmth: 0.24,
      backgroundAssetId: 'asset-bg',
      backgroundFit: 'contain'
    })).toEqual({
      ...DEFAULT_APP_CUSTOMIZATION,
      showChatAvatars: true,
      starColor: '#d6a4ff',
      starOpacity: 0.62,
      starGlow: 0.8,
      starScale: 1.12,
      starWarmth: 0.24,
      backgroundAssetId: 'asset-bg',
      customFontAssetIds: [],
      customFontScopeAssignments: {
        global: null,
        titles: null,
        chat: null,
        cards: null
      },
      backgroundFit: 'contain'
    });
  });

  it('stores the small-home date and replaceable photo presentation', () => {
    expect(mergeAppCustomizationPatch(DEFAULT_APP_CUSTOMIZATION, {
      relationshipStartDate: '2026-08-12',
      coupleImageAssetId: 'asset-couple',
      coupleImagePositionX: 42,
      coupleImagePositionY: 64,
      coupleImageScale: 1.35
    })).toEqual({
      ...DEFAULT_APP_CUSTOMIZATION,
      relationshipStartDate: '2026-08-12',
      coupleImageAssetId: 'asset-couple',
      coupleImagePositionX: 42,
      coupleImagePositionY: 64,
      coupleImageScale: 1.35
    });
  });
});
