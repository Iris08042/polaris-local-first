import { describe, expect, it } from 'vitest';
import { POLARIS_PUBLIC_PROVIDER } from '../../engines/freeProvider';
import type { ProviderProfile } from '../../types/domain';
import {
  buildGatewayPresetPatch,
  resolveGatewayPresetProviderAction
} from './useMenuGatewayController';

function buildProvider(patch: Partial<ProviderProfile> = {}): ProviderProfile {
  return {
    id: 'provider-1',
    name: 'OpenAI',
    protocol: 'openai-completions',
    baseUrl: 'https://api.openai.com/v1',
    path: '/chat/completions',
    apiKey: '',
    model: 'gpt-5.2',
    capabilities: {
      images: true,
      streaming: true,
      thinking: false
    },
    ...patch
  };
}

describe('menu gateway controller model', () => {
  it('builds the gateway preset without changing the selected model', () => {
    expect(buildGatewayPresetPatch(buildProvider({ name: 'Main', apiKey: 'sk-test', model: 'qwen-plus' }))).toEqual({
      name: 'Main · 无尽夏 Gateway',
      protocol: 'openai-completions',
      baseUrl: 'https://api.openai.com/v1',
      path: '/chat/completions',
      apiKey: 'sk-test',
      model: 'qwen-plus'
    });
  });

  it('opens gateway settings when there is no active provider id', () => {
    expect(resolveGatewayPresetProviderAction(buildProvider({ id: '' }))).toBe('open-gateway');
  });

  it('creates a custom provider when the active provider is the built-in trial route', () => {
    expect(resolveGatewayPresetProviderAction(POLARIS_PUBLIC_PROVIDER)).toBe('create');
  });

  it('duplicates an editable provider before applying the gateway preset', () => {
    expect(resolveGatewayPresetProviderAction(buildProvider())).toBe('duplicate');
  });
});
