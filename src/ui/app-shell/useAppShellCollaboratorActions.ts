import type { Dispatch, SetStateAction } from 'react';
import type { CodeCard, CollectionShelf, Conversation, Persona, PolarisCompanionConnection, World } from '../../types/domain';
import { disconnectCompanionConnection } from '../../app/companion/companionConnectionActions';
import {
  enterChatWorld,
  enterCollaboratorCollectionScope,
  revealCollaboratorInfo
} from '../../app/shell/frontstageNavigation';
import { startHeavySurfaceOpen } from '../../app/developer/runtime-performance/runtimePerformanceDebug';
import { isCompanionCollaboratorId } from '../../engines/companion';
import {
  orphanCollaboratorConversationSessions,
  openConversationForCollaborator
} from '../../app/chat/chatConversationSession';
import { type PersonaUpdatePatch } from '../shell/persona/personaUiShared';
import { loadCollaboratorBuilderTabModule } from './appShellLazyModules';

type CollaboratorIntroCardSeed = Pick<
  CodeCard,
  'title' | 'cardNote' | 'language' | 'code' | 'cardFaceCss' | 'tags' | 'source'
>;

type AppShellCollaboratorActionsArgs = {
  personas: Persona[];
  conversations: Conversation[];
  companionConnections: PolarisCompanionConnection[];
  editingCollaboratorId: string | null;
  collaboratorBuilderTargetId: string | null;
  frontstageCollaboratorId: string | null;
  activeCollaboratorId: string | null;
  collectionShelf: CollectionShelf;
  activeConversationId: string | null;
  activeConversationCollaboratorId: string | null;
  createConversation: (collaboratorId?: string | null) => string;
  createPersona: (options?: { activate?: boolean; template?: 'builder' | 'custom' }) => string;
  createCard: (seed?: Partial<CodeCard>) => string;
  deleteCollaborator: (collaboratorId: string) => boolean;
  orphanConversation: (conversationId: string) => void;
  updateCollaborator: (collaboratorId: string, patch: PersonaUpdatePatch) => void;
  setActiveCollaborator: (collaboratorId: string) => void;
  setEditingCollaboratorId: (collaboratorId: string | null) => void;
  setActiveCard: (cardId: string | null) => void;
  spotlightCard: (cardId: string | null) => void;
  setActiveConversation: (conversationId: string) => void;
  deleteCollaboratorThemeSession: (collaboratorId: string) => void;
  setWorld: (world: World) => void;
  setCollectionShelf: (shelf: CollectionShelf) => void;
  setFrontstageCollaboratorId: (collaboratorId: string | null) => void;
  clearPendingAttachments: () => void;
  clearPendingCardReference: () => void;
  rollbackPreviewForConversationDeletion: (conversationId: string) => boolean;
  closeMenu: () => void;
  setCollaboratorBuilderOpen: Dispatch<SetStateAction<boolean>>;
  setCollaboratorBuilderTargetId: Dispatch<SetStateAction<string | null>>;
};

export function useAppShellCollaboratorActions({
  personas,
  conversations,
  companionConnections,
  editingCollaboratorId,
  collaboratorBuilderTargetId,
  frontstageCollaboratorId,
  activeCollaboratorId,
  collectionShelf,
  activeConversationId,
  activeConversationCollaboratorId,
  createConversation,
  createPersona,
  createCard,
  deleteCollaborator,
  orphanConversation,
  updateCollaborator,
  setActiveCollaborator,
  setEditingCollaboratorId,
  setActiveCard,
  spotlightCard,
  setActiveConversation,
  deleteCollaboratorThemeSession,
  setWorld,
  setCollectionShelf,
  setFrontstageCollaboratorId,
  clearPendingAttachments,
  clearPendingCardReference,
  rollbackPreviewForConversationDeletion,
  closeMenu,
  setCollaboratorBuilderOpen,
  setCollaboratorBuilderTargetId
}: AppShellCollaboratorActionsArgs) {
  const findPersistedCollaborator = (collaboratorId: string) =>
    personas.find((persona) => persona.id === collaboratorId) ?? null;
  const findCollaborator = (collaboratorId: string) =>
    findPersistedCollaborator(collaboratorId) ?? null;

  const openCollaboratorInfo = (collaboratorId?: string | null) => {
    const targetCollaboratorId = collaboratorId !== undefined
      ? collaboratorId
      : editingCollaboratorId ?? frontstageCollaboratorId ?? activeCollaboratorId;

    if (targetCollaboratorId) {
      if (!isCompanionCollaboratorId(targetCollaboratorId)) {
        if (!findPersistedCollaborator(targetCollaboratorId)) {
          enterCollaboratorCollectionScope({
            setFrontstageCollaboratorId,
            setCollectionShelf,
            setWorld
          }, null);
          closeMenu();
          revealCollaboratorInfo({ setWorld, setCollectionShelf });
          return;
        }
        setActiveCollaborator(targetCollaboratorId);
        setEditingCollaboratorId(targetCollaboratorId);
      }
      enterCollaboratorCollectionScope({
        setFrontstageCollaboratorId,
        setCollectionShelf,
        setWorld
      }, targetCollaboratorId);
    } else if (collaboratorId === null) {
      enterCollaboratorCollectionScope({
        setFrontstageCollaboratorId,
        setCollectionShelf,
        setWorld
      }, null);
    }
    closeMenu();
    revealCollaboratorInfo({ setWorld, setCollectionShelf });
  };

  const openCollaboratorBuilder = (collaboratorId: string | null) => {
    if (collaboratorId && isCompanionCollaboratorId(collaboratorId)) {
      return;
    }
    closeMenu();
    void loadCollaboratorBuilderTabModule();
    startHeavySurfaceOpen('collaborator-builder' as Parameters<typeof startHeavySurfaceOpen>[0]);
    if (collaboratorId) {
      if (!findPersistedCollaborator(collaboratorId)) return;
      setEditingCollaboratorId(collaboratorId);
    }
    setCollaboratorBuilderTargetId(collaboratorId);
    setCollaboratorBuilderOpen(true);
  };

  const createCustomCollaborator = () => {
    closeMenu();
    const nextId = createPersona({ activate: false, template: 'custom' });
    openCollaboratorInfo(nextId);
  };

  const talkToCollaborator = (collaboratorId: string) => {
    if (isCompanionCollaboratorId(collaboratorId)) {
      const connection = companionConnections.find((entry) => entry.collaboratorId === collaboratorId) ?? null;
      if (!connection) return;
      setFrontstageCollaboratorId(collaboratorId);
      if (activeConversationId !== connection.conversationId) {
        clearPendingAttachments();
        clearPendingCardReference();
      }
      setActiveConversation(connection.conversationId);
      enterChatWorld({ setWorld });
      return;
    }
    if (!findPersistedCollaborator(collaboratorId)) return;
    setFrontstageCollaboratorId(collaboratorId);
    setActiveCollaborator(collaboratorId);
    setEditingCollaboratorId(collaboratorId);
    openConversationForCollaborator({
      conversations,
      personas,
      activeCollaboratorId
    }, {
      createConversation,
      setActiveConversation,
      clearPendingAttachments,
      clearPendingCardReference
    }, collaboratorId);
    enterChatWorld({ setWorld });
  };

  const deleteCollaboratorFromPanel = (collaboratorId: string) => {
    if (isCompanionCollaboratorId(collaboratorId)) {
      const connection = companionConnections.find((entry) => entry.collaboratorId === collaboratorId) ?? null;
      if (!connection || !window.confirm(`确认断开 ${connection.label}？这不会删掉电脑端，只会把手机这边的 companion 入口收掉。`)) return;
      void disconnectCompanionConnection(connection.id);
      if (activeConversationId === connection.conversationId) {
        orphanConversation(connection.conversationId);
      }
      if (frontstageCollaboratorId === collaboratorId) {
        setFrontstageCollaboratorId(activeCollaboratorId);
      }
      deleteCollaboratorThemeSession(collaboratorId);
      return;
    }
    const persona = findCollaborator(collaboratorId);
    if (!persona || !window.confirm(`确认删除 ${persona.name}？TA 的历史对话会保留在“全部”里，但不再归属于任何协作者。`)) return;

    const nextPersonas = personas.filter((candidate) => candidate.id !== collaboratorId);
    const fallbackCollaboratorId = nextPersonas[0]?.id ?? null;

    const wasCurrentCollaborator = frontstageCollaboratorId === collaboratorId;
    const wasEditingCollaborator = editingCollaboratorId === collaboratorId;
    const cleanup = orphanCollaboratorConversationSessions({
      collaboratorId,
      conversations,
      personas: nextPersonas,
      activeCollaboratorId,
      activeConversationId
    }, {
      createConversation,
      setActiveConversation,
      clearPendingAttachments,
      clearPendingCardReference,
      orphanConversation,
      rollbackPreviewForConversationDeletion
    });
    const didDelete = deleteCollaborator(collaboratorId);
    if (!didDelete) return;

    if (wasCurrentCollaborator || cleanup.nextConversationId || activeConversationCollaboratorId === collaboratorId) {
      setFrontstageCollaboratorId(cleanup.nextCollaboratorId ?? fallbackCollaboratorId);
    }
    if (wasEditingCollaborator) {
      setEditingCollaboratorId(cleanup.nextCollaboratorId ?? fallbackCollaboratorId);
    }
    deleteCollaboratorThemeSession(collaboratorId);
  };

  const closeCollaboratorBuilder = () => {
    setCollaboratorBuilderOpen(false);
    setCollaboratorBuilderTargetId(null);
  };

  return {
    openCollaboratorInfo,
    openCollaboratorBuilder,
    createCustomCollaborator,
    createCustomPersona: createCustomCollaborator,
    collaboratorBuilderBridge: {
      builderTargetCollaborator: personas.find((persona) => persona.id === collaboratorBuilderTargetId) ?? null,
      closeCollaboratorBuilder,
      applyBuilderToCurrent(patch: PersonaUpdatePatch) {
        const targetId = collaboratorBuilderTargetId ?? editingCollaboratorId;
        if (!targetId) return;
        updateCollaborator(targetId, patch);
        closeCollaboratorBuilder();
      },
      createCollaboratorFromBuilder(patch: PersonaUpdatePatch, introCard: CollaboratorIntroCardSeed) {
        const nextId = createPersona({ activate: false, template: 'builder' });
        updateCollaborator(nextId, patch);
        const introCardId = createCard({
          ...introCard,
          ownerCollaboratorId: nextId
        });
        closeCollaboratorBuilder();
        setActiveCollaborator(nextId);
        setEditingCollaboratorId(nextId);
        setFrontstageCollaboratorId(nextId);
        setActiveCard(introCardId);
        spotlightCard(introCardId);
        setCollectionShelf('code');
        setWorld('collection');
      }
    },
    talkToCollaborator,
    deleteCollaboratorFromPanel
  };
}
