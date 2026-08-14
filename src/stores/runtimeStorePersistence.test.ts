import { describe, expect, it } from 'vitest';
import { normalizeRuntimePayload } from './runtimeStorePersistence';

describe('normalizeRuntimePayload', () => {
  it('defaults toolbox settings when missing', () => {
    const payload = normalizeRuntimePayload();
    expect(payload.taskModeEnabled).toBe(false);
    expect(payload.toolPromptPreferences.environment).toBe(true);
    expect(payload.toolPromptPreferences.task).toBe(true);
    expect(payload.toolPromptPreferences.theme).toBe(true);
    expect(payload.toolPromptPreferences.project).toBe(false);
    expect(payload.toolPromptPreferences.mcp).toBe(true);
    expect(payload.toolPromptPreferences.knowledge).toBe(true);
    expect(payload.toolPromptPreferences.memory).toBe(true);
    expect(payload.toolPromptPreferences.memoryRecall).toBe(true);
    expect(payload.toolPromptPreferences.memoryWrite).toBe(false);
    expect(payload.toolPromptPreferences.personalData).toBe(false);
  });

  it('normalizes persisted web search config', () => {
    const payload = normalizeRuntimePayload({
      search: {
        provider: 'bocha',
        apiKey: 'bocha-key',
        bochaSummary: false,
        bochaFreshness: 'oneWeek',
        customEndpoint: ' https://search.example.com/search ',
        customAdapter: 'tavily',
        customLabel: ' My Search '
      }
    });

    expect(payload.search).toEqual({
      provider: 'bocha',
      apiKey: 'bocha-key',
      bochaSummary: false,
      bochaFreshness: 'oneWeek',
      customEndpoint: 'https://search.example.com/search',
      customAdapter: 'tavily',
      customLabel: 'My Search'
    });
  });

  it('keeps retired summary metadata but cannot reactivate the old runtime', () => {
    const payload = normalizeRuntimePayload({
      conversationSummaryModel: {
        enabled: true,
        autoUpdateEnabled: true,
        providerId: ' provider-a ',
        modelOverride: ' small-model ',
        targetSourceChars: 12_345,
        skipProcessedSources: false,
        lastUpdatedAt: 99
      }
    });

    expect(payload.conversationSummaryModel).toEqual({
      enabled: false,
      autoUpdateEnabled: false,
      providerId: 'provider-a',
      modelOverride: 'small-model',
      targetSourceChars: 12_345,
      skipProcessedSources: false,
      lastUpdatedAt: 99
    });
  });

  it('keeps image generation settings in the global runtime payload', () => {
    const payload = normalizeRuntimePayload({
      imageGeneration: {
        enabled: true,
        providerId: ' image-provider ',
        modelOverride: ' gpt-image-1 ',
        size: '1536x1024',
        lastUpdatedAt: 88
      }
    });

    expect(payload.imageGeneration).toEqual({
      enabled: true,
      providerId: 'image-provider',
      modelOverride: 'gpt-image-1',
      size: '1536x1024',
      lastUpdatedAt: 88
    });
  });

  it('keeps image understanding settings in the global runtime payload', () => {
    const payload = normalizeRuntimePayload({
      imageUnderstanding: {
        enabled: true,
        providerId: ' vision-provider ',
        modelOverride: ' qwen-vl ',
        lastUpdatedAt: 66
      }
    });

    expect(payload.imageUnderstanding).toEqual({
      enabled: true,
      providerId: 'vision-provider',
      modelOverride: 'qwen-vl',
      lastUpdatedAt: 66
    });
  });

  it('keeps dedicated voice generation settings in the global runtime payload', () => {
    const payload = normalizeRuntimePayload({
      voiceGeneration: {
        enabled: true,
        providerType: 'openai-compatible',
        baseUrl: ' https://voice.example.com/v1 ',
        path: ' /audio/speech ',
        apiKey: ' voice-key ',
        model: ' gpt-4o-mini-tts ',
        voice: ' alloy ',
        format: 'mp3',
        lastUpdatedAt: 77
      }
    });

    expect(payload.voiceGeneration).toEqual({
      enabled: true,
      providerType: 'openai-compatible',
      baseUrl: 'https://voice.example.com/v1',
      path: '/audio/speech',
      apiKey: 'voice-key',
      model: 'gpt-4o-mini-tts',
        providerId: undefined,
        modelOverride: undefined,
        voice: 'alloy',
        customVoices: [],
        format: 'mp3',
        lastUpdatedAt: 77
      });
  });

  it('keeps custom voice library entries in the voice generation settings', () => {
    const payload = normalizeRuntimePayload({
      voiceGeneration: {
        enabled: true,
        providerType: 'minimax',
        customVoices: [{
          id: ' custom-voice ',
          providerType: 'minimax',
          label: ' Warm Voice ',
          voice: ' custom_voice ',
          source: 'minimax-generation',
          createdAt: 88,
          updatedAt: 99
        }, {
          id: 'broken',
          providerType: 'minimax',
          label: 'Broken',
          voice: ''
        }]
      }
    });

    expect(payload.voiceGeneration.customVoices).toEqual([{
      id: 'custom-voice',
      providerType: 'minimax',
      label: 'Warm Voice',
      voice: 'custom_voice',
      source: 'minimax-generation',
      createdAt: 88,
      updatedAt: 99
    }]);
  });

  it('migrates legacy voice provider selection into dedicated voice route fields', () => {
    const payload = normalizeRuntimePayload({
      providers: [{
        id: 'voice-provider',
        name: 'Voice Provider',
        protocol: 'openai-completions',
        baseUrl: 'https://legacy-voice.example.com/v1',
        path: '/chat/completions',
        apiKey: 'legacy-key',
        model: 'legacy-tts',
        capabilities: {
          images: false,
          streaming: true,
          thinking: false
        }
      }],
      activeProviderId: 'voice-provider',
      voiceGeneration: {
        enabled: true,
        providerType: 'openai-compatible',
        providerId: ' voice-provider ',
        voice: ' alloy ',
        format: 'mp3',
        lastUpdatedAt: 66
      }
    });

    expect(payload.voiceGeneration).toEqual({
      enabled: true,
      providerType: 'openai-compatible',
      baseUrl: 'https://legacy-voice.example.com/v1',
      path: '/audio/speech',
      apiKey: 'legacy-key',
      model: 'legacy-tts',
        providerId: 'voice-provider',
        modelOverride: undefined,
        voice: 'alloy',
        customVoices: [],
        format: 'mp3',
        lastUpdatedAt: 66
      });
  });
});
