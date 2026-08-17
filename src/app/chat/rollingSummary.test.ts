import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MEMORY_SUMMARY_INSTRUCTION,
  resolveMemorySummary,
  resolveRollingSummaryProvider,
  resolveRollingSummaryReceiptMessageId,
  resolveRollingSummarySource
} from './rollingSummary';
import type { ChatMessage } from '../../types/domain';

function message(id: string, role: 'user' | 'assistant', content = id): ChatMessage {
  return { id, role, content, timestamp: Number(id.replace(/\D/g, '')) || 1 };
}

function conversationMessages(count: number) {
  return Array.from({ length: count }, (_, index) => (
    message(`m${index}`, index % 2 === 0 ? 'user' : 'assistant')
  ));
}

describe('resolveRollingSummarySource', () => {
  it('keeps the latest 200 real messages as raw context while all new messages can inform the memory summary', () => {
    const messages = conversationMessages(202);
    const source = resolveRollingSummarySource({
      messages,
      rollingSummary: null
    });
    expect(source.unsummarizedMessages).toHaveLength(200);
    expect(source.bufferedMessages).toHaveLength(200);
    expect(source.bufferedMessages[0]?.id).toBe('m2');
  });

  it('continues after the saved message cursor without rebuilding old text', () => {
    const messages = conversationMessages(204);
    const source = resolveRollingSummarySource({
      messages,
      rollingSummary: { version: 2, content: '旧摘要', throughMessageId: 'm1', updatedAt: 1 }
    });
    expect(source.unsummarizedMessages[0]?.id).toBe('m2');
    expect(source.unsummarizedMessages).toHaveLength(200);
    expect(source.bufferedMessages).toHaveLength(200);
  });

  it('ignores tool and system receipts when counting source messages', () => {
    const messages = conversationMessages(202);
    messages.splice(1, 0, { ...message('tool1', 'assistant'), origin: 'tool-runtime' });
    const source = resolveRollingSummarySource({
      messages,
      rollingSummary: null
    });
    expect(source.unsummarizedMessages).toHaveLength(200);
    expect(source.bufferedMessages).toHaveLength(200);
  });

  it('counts attachment-only user messages as real conversation messages', () => {
    const messages = conversationMessages(202);
    messages[0] = {
      ...message('m0', 'user', ''),
      attachments: [{
        id: 'a1',
        assetId: 'asset-1',
        kind: 'image',
        name: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 128
      }]
    };
    const source = resolveRollingSummarySource({ messages, rollingSummary: null });
    expect(source.unsummarizedMessages).toHaveLength(200);
    expect(source.bufferedMessages).toHaveLength(200);
  });

  it('does not count native tool-call assistant messages as real conversation messages', () => {
    const messages = conversationMessages(202);
    messages.splice(1, 0, {
      ...message('tool-call', 'assistant', 'calling'),
      nativeToolCalls: [{ id: 'call-1', name: 'hold', argumentsText: '{}' }]
    });
    const source = resolveRollingSummarySource({ messages, rollingSummary: null });
    expect(source.unsummarizedMessages).toHaveLength(200);
    expect(source.bufferedMessages).toHaveLength(200);
  });

  it('reaches the first automatic batch at 50 real messages', () => {
    const beforeThreshold = resolveRollingSummarySource({
      messages: conversationMessages(50),
      rollingSummary: null
    });
    const atThreshold = resolveRollingSummarySource({
      messages: conversationMessages(52),
      rollingSummary: null
    });

    expect(beforeThreshold.unsummarizedMessages).toHaveLength(48);
    expect(atThreshold.unsummarizedMessages).toHaveLength(50);
    expect(atThreshold.bufferedMessages).toHaveLength(52);
  });

  it('invalidates the old rolling-summary format so the incorrect existing summary is rebuilt', () => {
    const legacySummary = { content: '今天堵车回家。', throughMessageId: 'm1', updatedAt: 1 };
    const source = resolveRollingSummarySource({
      messages: conversationMessages(3),
      rollingSummary: legacySummary
    });

    expect(resolveMemorySummary(legacySummary)).toBeNull();
    expect(source.unsummarizedMessages).toHaveLength(2);
  });

  it('keeps the current editable user and assistant turn out of the summary source', () => {
    const first = resolveRollingSummarySource({
      messages: conversationMessages(4),
      rollingSummary: null
    });
    const afterNextTurn = resolveRollingSummarySource({
      messages: conversationMessages(6),
      rollingSummary: null
    });

    expect(first.unsummarizedMessages.map(item => item.id)).toEqual(['m0', 'm1']);
    expect(afterNextTurn.unsummarizedMessages.map(item => item.id)).toEqual(['m0', 'm1', 'm2', 'm3']);
  });
});

describe('memory summary instruction', () => {
  it('selects durable understanding and excludes daily chronology without fixed sections', () => {
    expect(DEFAULT_MEMORY_SUMMARY_INSTRUCTION).toContain('长期背景与稳定关系');
    expect(DEFAULT_MEMORY_SUMMARY_INSTRUCTION).toContain('天气、通勤');
    expect(DEFAULT_MEMORY_SUMMARY_INSTRUCTION).toContain('小标题不是固定栏目');
    expect(DEFAULT_MEMORY_SUMMARY_INSTRUCTION).toContain('用户对摘要的手动编辑优先级最高');
  });
});

describe('rolling summary provider', () => {
  it('keeps following the chat provider until the independent route is enabled', () => {
    expect(resolveRollingSummaryProvider({ enabled: false })).toBeNull();
  });

  it('builds an independent provider with its own key and model', () => {
    expect(resolveRollingSummaryProvider({
      enabled: false,
      dedicatedProviderEnabled: true,
      protocol: 'gemini-generate-content',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      path: '/models/{model}:generateContent',
      apiKey: 'summary-key',
      modelOverride: 'gemini-2.5-flash'
    })).toEqual(expect.objectContaining({
      protocol: 'gemini-generate-content',
      apiKey: 'summary-key',
      model: 'gemini-2.5-flash'
    }));
  });

  it('refuses to silently fall back after an incomplete independent route is enabled', () => {
    expect(() => resolveRollingSummaryProvider({
      enabled: false,
      dedicatedProviderEnabled: true,
      baseUrl: 'https://api.example.com/v1'
    })).toThrow('Base URL、API Key 和模型');
  });
});

describe('rolling summary receipt target', () => {
  it('captures the settled assistant bubble instead of searching again after async work', () => {
    const messages = [
      message('u1', 'user'),
      message('a1', 'assistant'),
      {
        ...message('tool-call', 'assistant', ''),
        nativeToolCalls: [{ id: 'call-1', name: 'hold', argumentsText: '{}' }]
      }
    ];
    expect(resolveRollingSummaryReceiptMessageId(messages)).toBe('a1');
  });
});
