import { describe, expect, it } from 'vitest';
import { resolveRollingSummarySource } from './rollingSummary';
import type { ChatMessage } from '../../types/domain';

function message(id: string, role: 'user' | 'assistant', content = id): ChatMessage {
  return { id, role, content, timestamp: Number(id.replace(/\D/g, '')) || 1 };
}

describe('resolveRollingSummarySource', () => {
  it('always leaves the current editable turn outside the summary', () => {
    const source = resolveRollingSummarySource({
      messages: [message('u1', 'user'), message('a1', 'assistant'), message('u2', 'user'), message('a2', 'assistant')],
      rollingSummary: null
    });
    expect(source.unsummarizedMessages.map(item => item.id)).toEqual(['u1', 'a1']);
    expect(source.bufferedMessages.map(item => item.id)).toEqual(['u2', 'a2']);
  });

  it('continues after the saved message cursor without rebuilding old text', () => {
    const source = resolveRollingSummarySource({
      messages: [message('u1', 'user'), message('a1', 'assistant'), message('u2', 'user'), message('a2', 'assistant'), message('u3', 'user')],
      rollingSummary: { content: '旧摘要', throughMessageId: 'a1', updatedAt: 1 }
    });
    expect(source.unsummarizedMessages.map(item => item.id)).toEqual(['u2', 'a2']);
    expect(source.bufferedMessages.map(item => item.id)).toEqual(['u3']);
  });

  it('ignores tool and system receipts when counting source messages', () => {
    const source = resolveRollingSummarySource({
      messages: [
        message('u1', 'user'),
        { ...message('tool1', 'assistant'), origin: 'tool-runtime' },
        message('a1', 'assistant'),
        message('u2', 'user')
      ],
      rollingSummary: null
    });
    expect(source.unsummarizedMessages.map(item => item.id)).toEqual(['u1', 'a1']);
  });
});
