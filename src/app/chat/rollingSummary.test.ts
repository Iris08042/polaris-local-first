import { describe, expect, it } from 'vitest';
import { resolveRollingSummaryReceiptMessageId, resolveRollingSummarySource } from './rollingSummary';
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
  it('always keeps the latest 200 real messages outside the summary', () => {
    const messages = conversationMessages(202);
    const source = resolveRollingSummarySource({
      messages,
      rollingSummary: null
    });
    expect(source.unsummarizedMessages.map(item => item.id)).toEqual(['m0', 'm1']);
    expect(source.bufferedMessages).toHaveLength(200);
    expect(source.bufferedMessages[0]?.id).toBe('m2');
  });

  it('continues after the saved message cursor without rebuilding old text', () => {
    const messages = conversationMessages(204);
    const source = resolveRollingSummarySource({
      messages,
      rollingSummary: { content: '旧摘要', throughMessageId: 'm1', updatedAt: 1 }
    });
    expect(source.unsummarizedMessages.map(item => item.id)).toEqual(['m2', 'm3']);
    expect(source.bufferedMessages).toHaveLength(200);
  });

  it('ignores tool and system receipts when counting source messages', () => {
    const messages = conversationMessages(202);
    messages.splice(1, 0, { ...message('tool1', 'assistant'), origin: 'tool-runtime' });
    const source = resolveRollingSummarySource({
      messages,
      rollingSummary: null
    });
    expect(source.unsummarizedMessages.map(item => item.id)).toEqual(['m0', 'm1']);
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
    expect(source.unsummarizedMessages.map(item => item.id)).toEqual(['m0', 'm1']);
    expect(source.bufferedMessages).toHaveLength(200);
  });

  it('does not count native tool-call assistant messages as real conversation messages', () => {
    const messages = conversationMessages(202);
    messages.splice(1, 0, {
      ...message('tool-call', 'assistant', 'calling'),
      nativeToolCalls: [{ id: 'call-1', name: 'hold', argumentsText: '{}' }]
    });
    const source = resolveRollingSummarySource({ messages, rollingSummary: null });
    expect(source.unsummarizedMessages.map(item => item.id)).toEqual(['m0', 'm1']);
    expect(source.bufferedMessages).toHaveLength(200);
  });

  it('reaches the first automatic batch at 250 real messages', () => {
    const beforeThreshold = resolveRollingSummarySource({
      messages: conversationMessages(249),
      rollingSummary: null
    });
    const atThreshold = resolveRollingSummarySource({
      messages: conversationMessages(250),
      rollingSummary: null
    });

    expect(beforeThreshold.unsummarizedMessages).toHaveLength(49);
    expect(atThreshold.unsummarizedMessages).toHaveLength(50);
    expect(atThreshold.bufferedMessages).toHaveLength(200);
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
