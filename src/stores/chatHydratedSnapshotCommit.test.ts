import { describe, expect, it, vi } from 'vitest';
import type { Conversation } from '../types/domain';
import type { PersistedChatState } from './chatCurrentPersistence';
import {
  filterRetiredGroupConversations,
  resolveHydratedActiveConversationId,
  scheduleHydratedSnapshotCommit
} from './chatHydratedSnapshotCommit';

function conversation(id: string, patch: Partial<Conversation> = {}): Conversation {
  return {
    id,
    title: id,
    collaboratorId: 'pharos',
    messages: [],
    pinnedAt: null,
    updatedAt: 1,
    ...patch
  };
}

describe('chat hydrated snapshot commit', () => {
  it('reads complete conversation bodies before committing an active-only recovered snapshot', async () => {
    const activeOnlyPayload: PersistedChatState = {
      activeConversationId: 'c-active',
      shouldCommitSnapshot: true,
      prunedConversationIds: ['c-pruned'],
      conversations: [conversation('c-active'), conversation('c-old')],
      loadedConversationIds: ['c-active']
    };
    const completePayload: PersistedChatState = {
      ...activeOnlyPayload,
      conversations: [
        conversation('c-active'),
        conversation('c-old', {
          messages: [{
            id: 'm-old',
            role: 'user',
            content: 'old body',
            timestamp: 1
          }]
        })
      ],
      loadedConversationIds: ['c-active', 'c-old']
    };
    const readCompleteState = vi.fn(async () => completePayload);
    const writeState = vi.fn(async () => undefined);
    const scheduledTasks: Array<() => Promise<void>> = [];

    expect(scheduleHydratedSnapshotCommit(activeOnlyPayload, {
      readCompleteState,
      writeState,
      schedule: (run) => {
        scheduledTasks.push(run);
      }
    })).toBe(true);

    await scheduledTasks[0]!();

    expect(readCompleteState).toHaveBeenCalledWith({ throwOnReadFailure: true });
    expect(writeState).toHaveBeenCalledWith(expect.objectContaining({
      activeConversationId: 'c-active',
      dirtyConversationIds: ['c-active', 'c-old'],
      loadedConversationIds: ['c-active', 'c-old'],
      deletedConversationIds: ['c-pruned']
    }));
  });

  it('refuses to commit a recovered snapshot with a missing active pointer', async () => {
    const writeState = vi.fn(async () => undefined);
    const scheduledTasks: Array<() => Promise<void>> = [];

    expect(scheduleHydratedSnapshotCommit({
      activeConversationId: 'c-missing',
      shouldCommitSnapshot: true,
      conversations: [conversation('c-live')],
      loadedConversationIds: ['c-live']
    }, {
      writeState,
      schedule: (run) => {
        scheduledTasks.push(run);
      }
    })).toBe(true);

    await scheduledTasks[0]!();

    expect(writeState).not.toHaveBeenCalled();
  });

  it('resolves active pointers only to live or lifecycle-pruned conversations', () => {
    const conversations = [conversation('c-live')];

    expect(resolveHydratedActiveConversationId('c-live', conversations, new Set())).toBe('c-live');
    expect(resolveHydratedActiveConversationId('c-archive', conversations, new Set(['c-archive']))).toBe('c-live');
    expect(() => resolveHydratedActiveConversationId('c-missing', conversations, new Set()))
      .toThrow('Active chat state points at a missing conversation: c-missing');
  });

  it('filters retired group conversations out of live hydration snapshots', () => {
    expect(filterRetiredGroupConversations([
      conversation('c-live'),
      conversation('c-retired', {
        groupRoomId: 'retired-room'
      }),
      conversation('c-group', {
        kind: 'group',
        group: {
          title: 'Legacy group',
          memberIds: ['pharos'],
          background: 'aurora',
          replyMode: 'round',
          allowMemberSilence: false,
          memoryRecallEnabled: false,
          toolSettings: {
            cards: false,
            images: false,
            attachments: false,
            web: false,
            mcp: false
          },
          privateLanes: {},
          createdAt: 1,
          updatedAt: 1
        }
      })
    ])).toEqual([expect.objectContaining({ id: 'c-live' })]);
  });
});
