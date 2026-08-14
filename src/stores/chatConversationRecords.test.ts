import { describe, expect, it, vi } from 'vitest';
import type { Conversation } from '../types/domain';
import {
  createDirectConversationRecord,
  orphanConversationInRecords,
  orphanConversationRecord,
  renameConversationInRecords,
  renameConversationRecord,
  toggleConversationPinnedInRecords,
  toggleConversationPinnedRecord,
  touchConversationInRecords,
  touchConversationRecord
} from './chatConversationRecords';

function directConversation(patch: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c-1',
    title: '新对话',
    kind: 'direct',
    collaboratorId: 'pharos',
    groupRoomId: null,
    activeProjectId: null,
    messages: [],
    pinnedAt: null,
    updatedAt: 1,
    ...patch
  };
}

describe('chat conversation records', () => {
  it('creates direct conversations with explicit ownership and project binding', () => {
    vi.setSystemTime(1234);

    expect(createDirectConversationRecord({
      collaboratorId: 'pharos',
      activeProjectId: 'workspace-1'
    })).toEqual(expect.objectContaining({
      title: '新对话',
      kind: 'direct',
      collaboratorId: 'pharos',
      activeProjectId: 'workspace-1',
      groupRoomId: null,
      draft: '',
      pinnedAt: null,
      updatedAt: 1234,
      messages: []
    }));

    vi.useRealTimers();
  });

  it('applies small conversation metadata transforms immutably', () => {
    vi.setSystemTime(2345);

    const base = directConversation();

    expect(touchConversationRecord(base)).toEqual(expect.objectContaining({
      updatedAt: 2345
    }));
    expect(renameConversationRecord(base, '新标题')).toEqual(expect.objectContaining({
      title: '新标题',
      updatedAt: 2345
    }));
    expect(toggleConversationPinnedRecord(base)).toEqual(expect.objectContaining({
      pinnedAt: 2345
    }));
    expect(orphanConversationRecord(base)).toEqual(expect.objectContaining({
      collaboratorId: null,
      updatedAt: 1
    }));
    expect(base).toEqual(expect.objectContaining({
      title: '新对话',
      collaboratorId: 'pharos',
      pinnedAt: null,
      updatedAt: 1
    }));

    vi.useRealTimers();
  });

  it('applies matching metadata transforms inside a record list', () => {
    vi.setSystemTime(3456);

    const first = directConversation({ id: 'c-1' });
    const second = directConversation({ id: 'c-2', title: 'Second', pinnedAt: null });
    const conversations = [first, second];

    expect(touchConversationInRecords(conversations, 'c-2')).toEqual([
      first,
      expect.objectContaining({ id: 'c-2', updatedAt: 3456 })
    ]);
    expect(renameConversationInRecords(conversations, 'c-2', '  Renamed  ')).toEqual([
      first,
      expect.objectContaining({ id: 'c-2', title: 'Renamed', updatedAt: 3456 })
    ]);
    expect(renameConversationInRecords(conversations, 'c-2', '   ')).toBeNull();
    expect(toggleConversationPinnedInRecords(conversations, 'c-2')).toEqual([
      first,
      expect.objectContaining({ id: 'c-2', pinnedAt: 3456 })
    ]);
    expect(orphanConversationInRecords(conversations, 'c-1')).toEqual([
      expect.objectContaining({ id: 'c-1', collaboratorId: null, updatedAt: 1 }),
      second
    ]);

    expect(first).toEqual(expect.objectContaining({
      collaboratorId: 'pharos',
      updatedAt: 1
    }));

    vi.useRealTimers();
  });
});
