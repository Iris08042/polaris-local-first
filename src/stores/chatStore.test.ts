import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleHydratedSnapshotCommit, useChatStore } from './chatStore';
import { createResolvedWorkspaceProposalFeedbackEvent } from '../engines/runtime-feedback/runtimeFeedbackEvents';
import type { PersistedChatState } from './chatCurrentPersistence';

describe('chatStore drafts', () => {
  beforeEach(() => {
    useChatStore.setState(useChatStore.getInitialState(), true);
  });

  it('keeps a separate draft for each conversation when switching', () => {
    const firstConversationId = useChatStore.getState().createConversation('pharos');
    useChatStore.getState().setInputDraft('first draft');

    const secondConversationId = useChatStore.getState().createConversation('pharos');
    useChatStore.getState().setInputDraft('second draft');

    useChatStore.getState().setActiveConversation(firstConversationId);
    expect(useChatStore.getState().inputDraft).toBe('first draft');

    useChatStore.getState().setActiveConversation(secondConversationId);
    expect(useChatStore.getState().inputDraft).toBe('second draft');
  });

  it('updates a non-active conversation draft without stealing the active draft', () => {
    const firstConversationId = useChatStore.getState().createConversation('pharos');
    useChatStore.getState().setInputDraft('first draft');

    const secondConversationId = useChatStore.getState().createConversation('pharos');
    useChatStore.getState().setInputDraft('second draft');

    useChatStore.getState().setConversationDraft(firstConversationId, 'updated first draft');

    expect(useChatStore.getState().activeConversationId).toBe(secondConversationId);
    expect(useChatStore.getState().inputDraft).toBe('second draft');
    expect(
      useChatStore.getState().conversations.find((conversation) => conversation.id === firstConversationId)?.draft
    ).toBe('updated first draft');

    useChatStore.getState().setActiveConversation(firstConversationId);
    expect(useChatStore.getState().inputDraft).toBe('updated first draft');
  });

  it('does not dirty persistence when the active draft is unchanged', () => {
    useChatStore.getState().createConversation('pharos');
    useChatStore.getState().setInputDraft('same draft');
    const before = useChatStore.getState().conversationPersistVersion;

    useChatStore.getState().setInputDraft('same draft');

    expect(useChatStore.getState().conversationPersistVersion).toBe(before);
  });

  it('marks the chat index dirty when the active conversation changes', () => {
    const firstConversationId = useChatStore.getState().createConversation('pharos');
    const secondConversationId = useChatStore.getState().createConversation('pharos');
    const before = useChatStore.getState();

    expect(before.activeConversationId).toBe(secondConversationId);
    useChatStore.getState().setActiveConversation(firstConversationId);

    const after = useChatStore.getState();
    expect(after.activeConversationId).toBe(firstConversationId);
    expect(after.dirtyConversationIds).toEqual(before.dirtyConversationIds);
    expect(after.conversationPersistVersion).toBe(before.conversationPersistVersion + 1);

    useChatStore.getState().setActiveConversation(firstConversationId);
    expect(useChatStore.getState().conversationPersistVersion).toBe(after.conversationPersistVersion);
  });

  it('restores the next active conversation draft after deleting the current one', () => {
    const firstConversationId = useChatStore.getState().createConversation('pharos');
    useChatStore.getState().setInputDraft('first draft');

    const secondConversationId = useChatStore.getState().createConversation('pharos');
    useChatStore.getState().setInputDraft('second draft');

    useChatStore.getState().deleteConversation(secondConversationId);

    expect(useChatStore.getState().activeConversationId).toBe(firstConversationId);
    expect(useChatStore.getState().inputDraft).toBe('first draft');
  });

  it('keeps deleted conversation ids until persistence can remove their message chunks', () => {
    const firstConversationId = useChatStore.getState().createConversation('pharos');
    const secondConversationId = useChatStore.getState().createConversation('pharos');

    useChatStore.getState().deleteConversation(secondConversationId);

    expect(useChatStore.getState().conversations.map((conversation) => conversation.id)).toEqual([firstConversationId]);
    expect(useChatStore.getState().dirtyConversationIds).not.toContain(secondConversationId);
    expect(useChatStore.getState().deletedConversationIds).toEqual([secondConversationId]);
  });

  it('flushes hydrated conversation creation immediately', () => {
    const persistToDb = vi.fn(async () => {});
    useChatStore.setState({ hydrated: true, persistToDb });

    useChatStore.getState().createConversation('pharos');

    expect(persistToDb).toHaveBeenCalledTimes(1);
  });

  it('flushes hydrated submitted user messages immediately without flushing assistant inserts', () => {
    const persistToDb = vi.fn(async () => {});
    const conversationId = useChatStore.getState().createConversation('pharos');
    useChatStore.setState({ hydrated: true, persistToDb });
    const writableConversation = useChatStore.getState().getConversationWritable(conversationId);
    expect(writableConversation).not.toBeNull();

    useChatStore.getState().addMessage(writableConversation!, {
      id: 'm-user',
      role: 'user',
      content: 'hi',
      timestamp: 1
    });
    useChatStore.getState().addMessage(writableConversation!, {
      id: 'm-assistant',
      role: 'assistant',
      content: 'hello',
      timestamp: 2
    });

    expect(persistToDb).toHaveBeenCalledTimes(1);
  });

  it('does not issue a writable target when the body is not loaded', () => {
    const conversationId = useChatStore.getState().createConversation('pharos');
    useChatStore.setState({
      conversationBodyStatuses: {
        [conversationId]: { state: 'notLoaded', updatedAt: 1 }
      },
      loadedMessageConversationIds: []
    });

    expect(useChatStore.getState().getConversationWritable(conversationId)).toBeNull();
  });

  it('schedules recovered snapshot writeback without blocking hydration on complete body reads', async () => {
    const activeOnlyPayload: PersistedChatState = {
      activeConversationId: 'c-active',
      shouldCommitSnapshot: true,
      prunedConversationIds: ['c-pruned'],
      conversations: [
        {
          id: 'c-active',
          title: 'Active',
          collaboratorId: 'pharos',
          messages: [],
          updatedAt: 2,
          pinnedAt: null
        },
        {
          id: 'c-old',
          title: 'Old',
          collaboratorId: 'pharos',
          messages: [],
          updatedAt: 1,
          pinnedAt: null
        }
      ],
      loadedConversationIds: ['c-active']
    };
    const completePayload: PersistedChatState = {
      ...activeOnlyPayload,
      conversations: activeOnlyPayload.conversations.map((conversation) => (
        conversation.id === 'c-old'
          ? {
              ...conversation,
              messages: [{
                id: 'm-old',
                role: 'user',
                content: 'old body',
                timestamp: 1
              }]
            }
          : conversation
      )),
      loadedConversationIds: ['c-active', 'c-old']
    };
    const readCompleteState = vi.fn(async () => completePayload);
    const writeState = vi.fn(async () => undefined);
    const scheduledTasks: Array<() => Promise<void>> = [];

    const scheduled = scheduleHydratedSnapshotCommit(activeOnlyPayload, {
      readCompleteState,
      writeState,
      schedule: (run) => {
        scheduledTasks.push(run);
      }
    });

    expect(scheduled).toBe(true);
    expect(readCompleteState).not.toHaveBeenCalled();
    expect(writeState).not.toHaveBeenCalled();

    expect(scheduledTasks).toHaveLength(1);
    await scheduledTasks[0]!();

    expect(readCompleteState).toHaveBeenCalledTimes(1);
    expect(writeState).toHaveBeenCalledWith(expect.objectContaining({
      activeConversationId: 'c-active',
      dirtyConversationIds: ['c-active', 'c-old'],
      loadedConversationIds: ['c-active', 'c-old'],
      deletedConversationIds: ['c-pruned']
    }));
  });

  it('does not rewrite a recovered snapshot with a guessed active conversation', async () => {
    const activeOnlyPayload: PersistedChatState = {
      activeConversationId: 'c-missing',
      shouldCommitSnapshot: true,
      conversations: [
        {
          id: 'c-live',
          title: 'Live',
          collaboratorId: 'pharos',
          messages: [],
          updatedAt: 2,
          pinnedAt: null
        }
      ],
      loadedConversationIds: ['c-live']
    };
    const writeState = vi.fn(async () => undefined);
    const scheduledTasks: Array<() => Promise<void>> = [];

    const scheduled = scheduleHydratedSnapshotCommit(activeOnlyPayload, {
      writeState,
      schedule: (run) => {
        scheduledTasks.push(run);
      }
    });

    expect(scheduled).toBe(true);
    expect(scheduledTasks).toHaveLength(1);

    await scheduledTasks[0]!();

    expect(writeState).not.toHaveBeenCalled();
  });

  it('flushes hydrated conversation deletes immediately', () => {
    const persistToDb = vi.fn(async () => {});
    const conversationId = useChatStore.getState().createConversation('pharos');
    useChatStore.setState({ hydrated: true, persistToDb });

    useChatStore.getState().deleteConversation(conversationId);

    expect(persistToDb).toHaveBeenCalledTimes(1);
  });

  it('marks matching attachment copies as cleared without reordering the conversation', () => {
    const conversationId = useChatStore.getState().createConversation('pharos');
    const writableConversation = useChatStore.getState().getConversationWritable(conversationId);
    expect(writableConversation).not.toBeNull();
    useChatStore.getState().addMessage(writableConversation!, {
      id: 'm-1',
      role: 'user',
      content: 'file',
      timestamp: 1,
      attachments: [
        {
          id: 'a-1',
          assetId: 'asset-temp',
          kind: 'file',
          name: 'notes.txt',
          mimeType: 'text/plain',
          size: 12,
          textContent: 'private notes'
        },
        {
          id: 'a-2',
          assetId: 'asset-keep',
          kind: 'file',
          name: 'keep.txt',
          mimeType: 'text/plain',
          size: 8,
          textContent: 'keep'
        }
      ]
    });
    const beforeUpdatedAt = useChatStore.getState().conversations.find((entry) => entry.id === conversationId)?.updatedAt;

    useChatStore.getState().clearConversationAttachmentsByAssetIds(['asset-temp'], 42);

    const conversation = useChatStore.getState().conversations.find((entry) => entry.id === conversationId);
    expect(conversation?.updatedAt).toBe(beforeUpdatedAt);
    expect(conversation?.messages[0]?.attachments?.[0]).toMatchObject({
      id: 'a-1',
      assetId: 'asset-temp',
      clearedAt: 42
    });
    expect(conversation?.messages[0]?.attachments?.[0]?.textContent).toBeUndefined();
    expect(conversation?.messages[0]?.attachments?.[1]).toMatchObject({
      id: 'a-2',
      textContent: 'keep'
    });
    expect(useChatStore.getState().dirtyConversationIds).toContain(conversationId);
  });

  it('stores workspace binding when creating a conversation inside a workspace', () => {
    const conversationId = useChatStore.getState().createConversation('pharos', {
      activeProjectId: 'workspace-7'
    });

    expect(useChatStore.getState().conversations[0]).toMatchObject({
      id: conversationId,
      collaboratorId: 'pharos',
      activeProjectId: 'workspace-7'
    });
  });

  it('clears conversation workspace bindings when the workspace no longer exists', () => {
    const staleConversationId = useChatStore.getState().createConversation('pharos', {
      activeProjectId: 'workspace-missing'
    });
    const liveConversationId = useChatStore.getState().createConversation('pharos', {
      activeProjectId: 'workspace-live'
    });
    const unboundConversationId = useChatStore.getState().createConversation('pharos');

    useChatStore.getState().reconcileConversationWorkspaceBindings(['workspace-live']);

    expect(useChatStore.getState().conversations.find((conversation) => conversation.id === staleConversationId)).toMatchObject({
      activeProjectId: null
    });
    expect(useChatStore.getState().conversations.find((conversation) => conversation.id === liveConversationId)).toMatchObject({
      activeProjectId: 'workspace-live'
    });
    expect(useChatStore.getState().conversations.find((conversation) => conversation.id === unboundConversationId)).toMatchObject({
      activeProjectId: null
    });
    expect(useChatStore.getState().dirtyConversationIds).toContain(staleConversationId);
  });

  it('does not assign Pharos when a conversation is created without a collaborator', () => {
    const conversationId = useChatStore.getState().createConversation();

    expect(useChatStore.getState().conversations[0]).toMatchObject({
      id: conversationId,
      collaboratorId: null
    });
  });

  it('creates and replaces the active conversation task shell from the latest user turn', () => {
    const conversationId = useChatStore.getState().createConversation('pharos');

    useChatStore.getState().ensureConversationTask(conversationId, [{
      id: 'user-1',
      role: 'user',
      content: '先做页面结构',
      timestamp: 1
    }]);

    expect(useChatStore.getState().getConversationTask(conversationId)).toMatchObject({
      sourceMessageId: 'user-1',
      goal: '先做页面结构',
      status: 'running'
    });

    useChatStore.getState().ensureConversationTask(conversationId, [{
      id: 'user-2',
      role: 'user',
      content: '不对，先把通知系统退回去',
      timestamp: 2
    }]);

    expect(useChatStore.getState().getConversationTask(conversationId)).toMatchObject({
      sourceMessageId: 'user-2',
      goal: '不对，先把通知系统退回去',
      status: 'running'
    });
  });

  it('can start a new task shell directly in active mode when task mode is already on', () => {
    const conversationId = useChatStore.getState().createConversation('pharos');

    useChatStore.getState().ensureConversationTask(conversationId, [{
      id: 'user-1',
      role: 'user',
      content: '把这个页面接着做完',
      timestamp: 1
    }], {
      mode: 'active'
    });

    expect(useChatStore.getState().getConversationTask(conversationId)).toMatchObject({
      sourceMessageId: 'user-1',
      goal: '把这个页面接着做完',
      mode: 'active',
      status: 'running'
    });
  });

  it('keeps an active task active when a workspace continuation runs with task mode off', () => {
    const conversationId = useChatStore.getState().createConversation('pharos');
    const messages = [{
      id: 'user-1',
      role: 'user' as const,
      content: '先进工作区继续做这个页面',
      timestamp: 1
    }];

    const activeTask = useChatStore.getState().ensureConversationTask(conversationId, messages, {
      mode: 'active'
    });

    const continuedTask = useChatStore.getState().ensureConversationTask(conversationId, messages, {
      mode: 'seed'
    });

    expect(continuedTask?.id).toBe(activeTask?.id);
    expect(useChatStore.getState().getConversationTask(conversationId)).toMatchObject({
      id: activeTask?.id,
      mode: 'active',
      sourceMessageId: 'user-1',
      goal: '先进工作区继续做这个页面'
    });
  });

  it('keeps an active task open across the next user turn when task mode is off', () => {
    const conversationId = useChatStore.getState().createConversation('pharos');
    const firstMessages = [{
      id: 'user-1',
      role: 'user' as const,
      content: '给这个房间换肤',
      timestamp: 1
    }];

    const activeTask = useChatStore.getState().ensureConversationTask(conversationId, firstMessages, {
      mode: 'active'
    });
    const continuedTask = useChatStore.getState().ensureConversationTask(conversationId, [
      ...firstMessages,
      {
        id: 'assistant-1',
        role: 'assistant' as const,
        content: '',
        timestamp: 2
      },
      {
        id: 'user-2',
        role: 'user' as const,
        content: '再把气泡调亮一点',
        timestamp: 3
      }
    ], {
      mode: 'seed'
    });

    expect(continuedTask?.id).toBe(activeTask?.id);
    expect(useChatStore.getState().getConversationTask(conversationId)).toMatchObject({
      id: activeTask?.id,
      mode: 'active',
      sourceMessageId: 'user-1',
      goal: '给这个房间换肤'
    });
  });

  it('records workspace scope changes when a conversation enters, switches, and exits a workspace', () => {
    const conversationId = useChatStore.getState().createConversation('pharos');

    useChatStore.getState().setConversationActiveProject(conversationId, 'workspace-1');
    useChatStore.getState().setConversationActiveProject(conversationId, 'workspace-2');
    useChatStore.getState().setConversationActiveProject(conversationId, null);

    expect(useChatStore.getState().getWorkspaceScopeEvents(conversationId)).toEqual([
      expect.objectContaining({
        conversationId,
        previousProjectId: null,
        nextProjectId: 'workspace-1',
        kind: 'entered'
      }),
      expect.objectContaining({
        conversationId,
        previousProjectId: 'workspace-1',
        nextProjectId: 'workspace-2',
        kind: 'switched'
      }),
      expect.objectContaining({
        conversationId,
        previousProjectId: 'workspace-2',
        nextProjectId: null,
        kind: 'exited'
      })
    ]);
    expect(useChatStore.getState().getRuntimeFeedbackEvents(conversationId)).toEqual([
      expect.objectContaining({
        kind: 'workspace_scope_changed',
        conversationId,
        change: 'entered',
        previousProjectId: null,
        nextProjectId: 'workspace-1'
      }),
      expect.objectContaining({
        kind: 'workspace_scope_changed',
        conversationId,
        change: 'switched',
        previousProjectId: 'workspace-1',
        nextProjectId: 'workspace-2'
      }),
      expect.objectContaining({
        kind: 'workspace_scope_changed',
        conversationId,
        change: 'exited',
        previousProjectId: 'workspace-2',
        nextProjectId: null
      })
    ]);
    expect(useChatStore.getState().conversations[0]?.workspaceLedger).toEqual([
      expect.objectContaining({
        kind: 'workspace_scope_changed',
        change: 'entered',
        previousProjectId: null,
        nextProjectId: 'workspace-1'
      }),
      expect.objectContaining({
        kind: 'workspace_scope_changed',
        change: 'switched',
        previousProjectId: 'workspace-1',
        nextProjectId: 'workspace-2'
      }),
      expect.objectContaining({
        kind: 'workspace_scope_changed',
        change: 'exited',
        previousProjectId: 'workspace-2',
        nextProjectId: null
      })
    ]);
  });

  it('does not emit a workspace scope event when the binding stays the same', () => {
    const conversationId = useChatStore.getState().createConversation('pharos', {
      activeProjectId: 'workspace-7'
    });
    const before = useChatStore.getState();

    useChatStore.getState().setConversationActiveProject(conversationId, 'workspace-7');

    const after = useChatStore.getState();
    expect(after.getWorkspaceScopeEvents(conversationId)).toEqual([]);
    expect(after.getRuntimeFeedbackEvents(conversationId)).toEqual([]);
    expect(after.conversationPersistVersion).toBe(before.conversationPersistVersion);
  });

  it('persists resolved workspace proposal decisions into the conversation ledger', () => {
    const conversationId = useChatStore.getState().createConversation('pharos');
    const before = useChatStore.getState();
    const resolvedEvent = createResolvedWorkspaceProposalFeedbackEvent({
      proposal: {
        id: 'proposal-1',
        conversationId,
        source: 'model-proposed',
        requestedProjectTitle: 'Mini Phone',
        requestedActionKinds: ['createRoomProject'],
      requestedFilePaths: ['index.html'],
      draftProjectId: 'workspace-mini-phone',
      status: 'pending',
      createdAt: 1
    },
      decision: 'accepted',
      resolvedWorkspaceLabel: 'Mini Phone',
      createdAt: 10
    });

    useChatStore.getState().appendRuntimeFeedbackEvent(conversationId, resolvedEvent);

    const after = useChatStore.getState();
    expect(after.getRuntimeFeedbackEvents(conversationId)).toEqual([
      expect.objectContaining({
        kind: 'workspace_proposal_resolved',
        decision: 'accepted'
      })
    ]);
    expect(after.conversations[0]?.workspaceLedger).toEqual([
      expect.objectContaining({
        kind: 'workspace_proposal_resolved',
        decision: 'accepted',
        proposalId: 'proposal-1'
      })
    ]);
    expect(after.conversationPersistVersion).toBe(before.conversationPersistVersion + 1);
  });

  it('keeps transient preparation failures out of the persisted workspace ledger', () => {
    const conversationId = useChatStore.getState().createConversation('pharos');
    const before = useChatStore.getState();

    useChatStore.getState().appendRuntimeFeedbackEvent(conversationId, {
      id: 'rtf-prep-1',
      kind: 'assistant_tool_preparation_failed',
      createdAt: 5,
      status: 'parse_failed',
      summary: '上一轮工具准备失败，工具块没有通过解析。',
      reasons: ['工具块里没有找到可执行动作。']
    });

    const after = useChatStore.getState();
    expect(after.getRuntimeFeedbackEvents(conversationId)).toEqual([
      expect.objectContaining({
        kind: 'assistant_tool_preparation_failed',
        status: 'parse_failed'
      })
    ]);
    expect(after.conversations[0]?.workspaceLedger).toBeUndefined();
    expect(after.conversationPersistVersion).toBe(before.conversationPersistVersion);
  });

  it('keeps pending workspace proposals in proposal state instead of runtime feedback', () => {
    const conversationId = useChatStore.getState().createConversation('pharos');

    useChatStore.getState().upsertPendingWorkspaceProposal({
      id: 'proposal-1',
      conversationId,
      source: 'model-proposed',
      requestedProjectTitle: 'Mini Phone',
      requestedActions: [],
      requestedActionKinds: ['createRoomProject'],
      requestedFilePaths: ['index.html'],
      draftProjectId: 'mini-phone',
      status: 'pending',
      createdAt: 1
    });

    useChatStore.getState().upsertPendingWorkspaceProposal({
      id: 'proposal-2',
      conversationId,
      source: 'model-proposed',
      requestedProjectTitle: 'Ocean Glass',
      requestedActions: [],
      requestedActionKinds: ['createRoomProject'],
      requestedFilePaths: ['app.js'],
      draftProjectId: 'ocean-glass',
      status: 'pending',
      createdAt: 3
    });

    expect(useChatStore.getState().pendingWorkspaceProposals).toEqual([
      expect.objectContaining({
        id: 'proposal-2',
        conversationId
      })
    ]);
    expect(useChatStore.getState().getRuntimeFeedbackEvents(conversationId)).toEqual([]);

    useChatStore.getState().removePendingWorkspaceProposal('proposal-2');

    expect(useChatStore.getState().pendingWorkspaceProposals).toEqual([]);
    expect(useChatStore.getState().getRuntimeFeedbackEvents(conversationId)).toEqual([]);
  });
});
