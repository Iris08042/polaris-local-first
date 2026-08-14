import { resolveConversationCollaboratorId } from '../../engines/conversationOwnership';
import { useChatStore } from '../../stores/chatStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { usePersonaStore } from '../../stores/personaStore';
import { selectRuntimeApi, useRuntimeStore } from '../../stores/runtimeStore';
import { useSpaceFrontstageBindings } from '../../stores/spaceStoreFrontstageBindings';
import { useSpaceThemeSessionBindings } from '../../stores/spaceStoreThemeSessionBindings';

export function useAppShellStoreBindings() {
  const frontstage = useSpaceFrontstageBindings();
  const themeSession = useSpaceThemeSessionBindings();

  const api = useRuntimeStore(selectRuntimeApi);
  const providers = useRuntimeStore((state) => state.providers);
  const companionHost = useRuntimeStore((state) => state.companionHost);
  const companionConnections = useRuntimeStore((state) => state.companionConnections);
  const companionSnapshots = useRuntimeStore((state) => state.companionSnapshots);
  const setApiConfig = useRuntimeStore((state) => state.setApiConfig);
  const setActiveProvider = useRuntimeStore((state) => state.setActiveProvider);
  const createProvider = useRuntimeStore((state) => state.createProvider);
  const importProvider = useRuntimeStore((state) => state.importProvider);
  const duplicateProvider = useRuntimeStore((state) => state.duplicateProvider);
  const deleteProvider = useRuntimeStore((state) => state.deleteProvider);
  const deleteCompanionConnection = useRuntimeStore((state) => state.deleteCompanionConnection);

  const personas = usePersonaStore((state) => state.personas);
  const activeCollaboratorId = usePersonaStore((state) => state.activeCollaboratorId);
  const createPersona = usePersonaStore((state) => state.createPersona);
  const setActiveCollaborator = usePersonaStore((state) => state.setActiveCollaborator);
  const deleteCollaborator = usePersonaStore((state) => state.deleteCollaborator);
  const updateCollaborator = usePersonaStore((state) => state.updateCollaborator);
  const activeCollaborator = personas.find((persona) => persona.id === activeCollaboratorId) ?? null;

  const conversations = useChatStore((state) => state.conversations);
  const loadedMessageConversationIds = useChatStore((state) => state.loadedMessageConversationIds);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const createConversation = useChatStore((state) => state.createConversation);
  const renameConversation = useChatStore((state) => state.renameConversation);
  const toggleConversationPinned = useChatStore((state) => state.toggleConversationPinned);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const orphanConversation = useChatStore((state) => state.orphanConversation);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const activeConversationTitle = activeConversation?.title ?? null;
  const activeConversationCollaboratorId = activeConversation
    ? resolveConversationCollaboratorId(activeConversation)
    : null;
  const activeConversationMessageCount = activeConversation?.messages.length ?? 0;

  const collectionHydrated = useCollectionStore((state) => state.hydrated);
  const collectionCards = useCollectionStore((state) => state.cards);
  const imageCards = useCollectionStore((state) => state.imageCards);
  const roomProjects = useCollectionStore((state) => state.roomProjects);
  const projectFiles = useCollectionStore((state) => state.projectFiles);
  const createCard = useCollectionStore((state) => state.createCard);
  const backfillOwnershipFromConversations = useCollectionStore((state) => state.backfillOwnershipFromConversations);

  return {
    space: {
      ...frontstage,
      activeThemePreview: themeSession.activeThemePreview,
      theme: themeSession.theme,
      customization: themeSession.customization,
      setCustomization: themeSession.setCustomization,
      deleteCollaboratorThemeSession: themeSession.deleteCollaboratorThemeSession
    },
    runtime: {
      api,
      providers,
      activeProviderId: api.id,
      companionHost,
      companionConnections,
      companionSnapshots,
      setApiConfig,
      setActiveProvider,
      createProvider,
      importProvider,
      duplicateProvider,
      deleteProvider,
      deleteCompanionConnection
    },
    collaborator: {
      personas,
      activeCollaboratorId,
      activeCollaborator,
      createPersona,
      setActiveCollaborator,
      deleteCollaborator,
      updateCollaborator
    },
    chat: {
      conversations,
      loadedMessageConversationIds,
      activeConversationId,
      activeConversationTitle,
      activeConversationCollaboratorId,
      activeConversationMessageCount,
      createConversation,
      renameConversation,
      toggleConversationPinned,
      orphanConversation,
      deleteConversation,
      setActiveConversation
    },
    collection: {
      collectionHydrated,
      collectionCards,
      imageCards,
      roomProjects,
      projectFiles,
      createCard,
      backfillOwnershipFromConversations
    }
  };
}

export type AppShellStoreBindings = ReturnType<typeof useAppShellStoreBindings>;
