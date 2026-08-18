import { describe, expect, it } from 'vitest';
import { compactToolEventSummary, toolEventCopy } from './chatToolLabels';
import type { ToolInvocation } from '../../../types/domain';

function baseToolInvocation(partial: Partial<ToolInvocation>): ToolInvocation {
  return {
    id: 'tool-1',
    kind: 'patchRawCss',
    status: 'preview',
    title: '创意 CSS 试穿',
    summary: '回复气泡 · .app-shell.chat .bubble.assistant { background: pink; }',
    ...partial
  };
}

describe('chatToolLabels', () => {
  it('describes creative previews without mount jargon', () => {
    expect(toolEventCopy(baseToolInvocation({
      themeScope: 'chat'
    }))).toContain('可应用这版，或取消这次试穿');
  });

  it('describes applied creative previews without old shell language', () => {
    expect(toolEventCopy(baseToolInvocation({
      themeScope: 'app',
      status: 'applied'
    }))).toContain('这一版改动已保留');
  });

  it('shows the scheduled message confirmation beneath the assistant reply', () => {
    expect(compactToolEventSummary(baseToolInvocation({
      kind: 'invokeMcpTool',
      status: 'executed',
      mcpResult: {
        serverId: 'polaris-scheduled-message',
        serverName: '定时主动消息',
        toolName: 'scheduled_message',
        argumentsObject: { action: 'create' },
        structuredContent: {
          receipt: '主动消息已设置在 2026年8月19日 09:00'
        }
      }
    }))).toBe('主动消息已设置在 2026年8月19日 09:00');
  });
});
