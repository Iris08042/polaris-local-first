import { describe, expect, it, vi, afterEach } from 'vitest';
import { createPersonaTemplate } from '../../config/persona/personaBuilder';
import type { Conversation } from '../../types/domain';
import { useAppShellCollaboratorActions } from './useAppShellCollaboratorActions';

function conversation(id: string, collaboratorId: string | null): Conversation {
  return {
    id,
    title: id,
    collaboratorId,
    activeProjectId: null,
    messages: [{
      id: `${id}-message`,
      role: 'user',
      content: id,
      timestamp: 1
    }],
    toolLedger: [],
    workspaceLedger: [],
    task: null,
    draft: '',
    pinnedAt: null,
    updatedAt: 1
  };
}

describe('useAppShellCollaboratorActions', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalWindow === undefined) {
      // @ts-expect-error test cleanup for node environment
      delete globalThis.window;
      return;
    }
    globalThis.window = originalWindow;
  });

  it('moves the editing collaborator fallback in the action layer when deleting the current collaborator', () => {
    globalThis.window = {
      confirm: vi.fn(() => true)
    } as unknown as Window & typeof globalThis;

    const setEditingCollaboratorId = vi.fn();
    const setFrontstageCollaboratorId = vi.fn();
    const deleteCollaborator = vi.fn(() => true);

    const actions = useAppShellCollaboratorActions({
      personas: [
        createPersonaTemplate({
          id: 'pharos',
          name: 'Pharos',
          description: '灯塔'
        }),
        createPersonaTemplate({
          id: 'persona-2',
          name: 'Nova',
          description: '第二人格'
        })
      ],
      conversations: [],
      companionConnections: [],
      editingCollaboratorId: 'persona-2',
      collaboratorBuilderTargetId: null,
      frontstageCollaboratorId: null,
      activeCollaboratorId: 'pharos',
      collectionShelf: 'info',
      activeConversationId: null,
      activeConversationCollaboratorId: null,
      createConversation: vi.fn(() => 'conversation-1'),
      createPersona: vi.fn(() => 'persona-new'),
      createCard: vi.fn(() => 'card-new'),
      deleteCollaborator,
      orphanConversation: vi.fn(),
      updateCollaborator: vi.fn(),
      setActiveCollaborator: vi.fn(),
      setEditingCollaboratorId,
      setActiveCard: vi.fn(),
      spotlightCard: vi.fn(),
      setActiveConversation: vi.fn(),
      deleteCollaboratorThemeSession: vi.fn(),
      setWorld: vi.fn(),
      setCollectionShelf: vi.fn(),
      setFrontstageCollaboratorId,
      clearPendingAttachments: vi.fn(),
      clearPendingCardReference: vi.fn(),
      rollbackPreviewForConversationDeletion: vi.fn(() => false),
      closeMenu: vi.fn(),
      setCollaboratorBuilderOpen: vi.fn(),
      setCollaboratorBuilderTargetId: vi.fn()
    });

    actions.deleteCollaboratorFromPanel('persona-2');

    expect(deleteCollaborator).toHaveBeenCalledWith('persona-2');
    expect(setEditingCollaboratorId).toHaveBeenCalledWith('pharos');
    expect(setFrontstageCollaboratorId).not.toHaveBeenCalled();
  });

  it('creates an intro room card when the builder creates a collaborator', () => {
    const createPersona = vi.fn(() => 'persona-new');
    const createCard = vi.fn(() => 'card-new');
    const updateCollaborator = vi.fn();
    const setActiveCollaborator = vi.fn();
    const setEditingCollaboratorId = vi.fn();
    const setFrontstageCollaboratorId = vi.fn();
    const setActiveCard = vi.fn();
    const spotlightCard = vi.fn();
    const setCollectionShelf = vi.fn();
    const setWorld = vi.fn();
    const setCollaboratorBuilderOpen = vi.fn();
    const setCollaboratorBuilderTargetId = vi.fn();

    const actions = useAppShellCollaboratorActions({
      personas: [],
      conversations: [],
      companionConnections: [],
      editingCollaboratorId: null,
      collaboratorBuilderTargetId: null,
      frontstageCollaboratorId: null,
      activeCollaboratorId: null,
      collectionShelf: 'info',
      activeConversationId: null,
      activeConversationCollaboratorId: null,
      createConversation: vi.fn(() => 'conversation-1'),
      createPersona,
      createCard,
      deleteCollaborator: vi.fn(() => true),
      orphanConversation: vi.fn(),
      updateCollaborator,
      setActiveCollaborator,
      setEditingCollaboratorId,
      setActiveCard,
      spotlightCard,
      setActiveConversation: vi.fn(),
      deleteCollaboratorThemeSession: vi.fn(),
      setWorld,
      setCollectionShelf,
      setFrontstageCollaboratorId,
      clearPendingAttachments: vi.fn(),
      clearPendingCardReference: vi.fn(),
      rollbackPreviewForConversationDeletion: vi.fn(() => false),
      closeMenu: vi.fn(),
      setCollaboratorBuilderOpen,
      setCollaboratorBuilderTargetId
    });

    actions.collaboratorBuilderBridge.createCollaboratorFromBuilder({
      name: 'Null',
      description: '裂缝'
    }, {
      title: 'Null · 人设卡',
      cardNote: '裂缝',
      language: 'markdown',
      code: 'Null',
      cardFaceCss: '& { color: #111; }',
      tags: ['人设'],
      source: 'manual'
    });

    expect(createPersona).toHaveBeenCalledWith({ activate: false, template: 'builder' });
    expect(updateCollaborator).toHaveBeenCalledWith('persona-new', {
      name: 'Null',
      description: '裂缝'
    });
    expect(createCard).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Null · 人设卡',
      ownerCollaboratorId: 'persona-new'
    }));
    expect(setActiveCollaborator).toHaveBeenCalledWith('persona-new');
    expect(setEditingCollaboratorId).toHaveBeenCalledWith('persona-new');
    expect(setFrontstageCollaboratorId).toHaveBeenCalledWith('persona-new');
    expect(setActiveCard).toHaveBeenCalledWith('card-new');
    expect(spotlightCard).toHaveBeenCalledWith('card-new');
    expect(setCollectionShelf).toHaveBeenCalledWith('code');
    expect(setWorld).toHaveBeenCalledWith('collection');
    expect(setCollaboratorBuilderOpen).toHaveBeenCalledWith(false);
    expect(setCollaboratorBuilderTargetId).toHaveBeenCalledWith(null);
  });

  it('opens a collaborator info page in collection', () => {
    const setActiveCollaborator = vi.fn();
    const setEditingCollaboratorId = vi.fn();
    const setFrontstageCollaboratorId = vi.fn();
    const setCollectionShelf = vi.fn();
    const setWorld = vi.fn();

    const actions = useAppShellCollaboratorActions({
      personas: [
        createPersonaTemplate({
          id: 'pharos',
          name: 'Pharos',
          description: '灯塔'
        })
      ],
      conversations: [],
      companionConnections: [],
      editingCollaboratorId: null,
      collaboratorBuilderTargetId: null,
      frontstageCollaboratorId: null,
      activeCollaboratorId: null,
      collectionShelf: 'info',
      activeConversationId: null,
      activeConversationCollaboratorId: null,
      createConversation: vi.fn(() => 'conversation-1'),
      createPersona: vi.fn(() => 'persona-new'),
      createCard: vi.fn(() => 'card-new'),
      deleteCollaborator: vi.fn(() => true),
      orphanConversation: vi.fn(),
      updateCollaborator: vi.fn(),
      setActiveCollaborator,
      setEditingCollaboratorId,
      setActiveCard: vi.fn(),
      spotlightCard: vi.fn(),
      setActiveConversation: vi.fn(),
      deleteCollaboratorThemeSession: vi.fn(),
      setWorld,
      setCollectionShelf,
      setFrontstageCollaboratorId,
      clearPendingAttachments: vi.fn(),
      clearPendingCardReference: vi.fn(),
      rollbackPreviewForConversationDeletion: vi.fn(() => false),
      closeMenu: vi.fn(),
      setCollaboratorBuilderOpen: vi.fn(),
      setCollaboratorBuilderTargetId: vi.fn()
    });

    actions.openCollaboratorInfo('pharos');

    expect(setActiveCollaborator).toHaveBeenCalledWith('pharos');
    expect(setEditingCollaboratorId).toHaveBeenCalledWith('pharos');
    expect(setFrontstageCollaboratorId).toHaveBeenCalledWith('pharos');
    expect(setCollectionShelf).toHaveBeenCalledWith('info');
    expect(setWorld).toHaveBeenCalledWith('collection');
  });

  it('ignores a missing conversation owner instead of creating a collaborator for deletion', () => {
    globalThis.window = {
      confirm: vi.fn(() => true)
    } as unknown as Window & typeof globalThis;

    const deleteCollaborator = vi.fn(() => true);
    const orphanConversation = vi.fn();

    const actions = useAppShellCollaboratorActions({
      personas: [
        createPersonaTemplate({
          id: 'pharos',
          name: 'Pharos',
          description: '灯塔'
        })
      ],
      conversations: [
        conversation('conversation-zombie', 'persona-missing'),
        conversation('conversation-known', 'pharos')
      ],
      companionConnections: [],
      editingCollaboratorId: 'persona-missing',
      collaboratorBuilderTargetId: null,
      frontstageCollaboratorId: 'persona-missing',
      activeCollaboratorId: 'pharos',
      collectionShelf: 'info',
      activeConversationId: 'conversation-zombie',
      activeConversationCollaboratorId: 'persona-missing',
      createConversation: vi.fn(() => 'conversation-next'),
      createPersona: vi.fn(() => 'persona-new'),
      createCard: vi.fn(() => 'card-new'),
      deleteCollaborator,
      orphanConversation,
      updateCollaborator: vi.fn(),
      setActiveCollaborator: vi.fn(),
      setEditingCollaboratorId: vi.fn(),
      setActiveCard: vi.fn(),
      spotlightCard: vi.fn(),
      setActiveConversation: vi.fn(),
      deleteCollaboratorThemeSession: vi.fn(),
      setWorld: vi.fn(),
      setCollectionShelf: vi.fn(),
      setFrontstageCollaboratorId: vi.fn(),
      clearPendingAttachments: vi.fn(),
      clearPendingCardReference: vi.fn(),
      rollbackPreviewForConversationDeletion: vi.fn(() => false),
      closeMenu: vi.fn(),
      setCollaboratorBuilderOpen: vi.fn(),
      setCollaboratorBuilderTargetId: vi.fn()
    });

    actions.deleteCollaboratorFromPanel('persona-missing');

    expect(window.confirm).not.toHaveBeenCalled();
    expect(deleteCollaborator).not.toHaveBeenCalled();
    expect(orphanConversation).not.toHaveBeenCalled();
  });
});
