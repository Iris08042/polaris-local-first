import { describe, expect, it, vi } from 'vitest';
import { createDisabledLegacyMemoryActions } from './disabledLegacyMemoryActions';

describe('disabled legacy memory actions', () => {
  it('cannot read or write the retired Polaris memory system', async () => {
    const setCommandStatus = vi.fn();
    const actions = createDisabledLegacyMemoryActions({ setCommandStatus });

    expect(actions.listCollaboratorMemoryDocs?.()).toEqual([]);
    expect(await actions.readCollaboratorMemoryDoc('old-doc')).toBeNull();
    expect(actions.appendCollaboratorMemories(['old memory'])).toBe(false);
    expect(actions.writeCollaboratorMemoryDoc({ title: 'old', content: 'old' }))
      .toEqual({ ok: false, error: '北极星旧记忆系统已停用，请使用 OB 长期记忆。' });
  });

  it('blocks legacy writes but leaves OB MCP actions untouched', () => {
    const setCommandStatus = vi.fn();
    const actions = createDisabledLegacyMemoryActions({ setCommandStatus });

    expect(actions.maybeHandleWriteMemoryAction({} as never, {
      kind: 'writeMemory',
      memory: ['old memory']
    })).toBe(true);
    expect(actions.maybeHandleWriteMemoryAction({} as never, {
      kind: 'invokeMcpTool',
      serverId: 'ob',
      serverName: 'OB',
      toolName: 'hold',
      argumentsObject: {}
    })).toBe(false);
    expect(setCommandStatus).toHaveBeenCalledWith(
      '北极星旧记忆系统已停用，请使用 OB 长期记忆。',
      true
    );
  });
});
