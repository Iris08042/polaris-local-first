import type { SpaceFrontstageActions, SpaceFrontstageState } from './spaceStoreTypes';
import type { SpaceStoreSet } from './spaceStoreActionShared';
import { switchCollaboratorThemeSession } from './spaceStoreCollaboratorThemes';
import { mergeDisplayPreferencesPatch } from './spaceStoreDisplayPreferences';
import { createUid } from '../engines/id';

export function createSpaceFrontstageActions(set: SpaceStoreSet): SpaceFrontstageActions {
  return {
    toggleWorld: () =>
    set((state) => ({
        activeWorld: state.activeWorld === 'collection' ? 'chat' : 'collection'
      })),
    setWorld: (world: SpaceFrontstageState['activeWorld']) => set({ activeWorld: world }),
    setCollectionShelf: (collectionShelf: SpaceFrontstageState['collectionShelf']) => set({ collectionShelf }),
    setFrontstageCollaboratorId: (frontstageCollaboratorId: string | null) =>
      set((state) => switchCollaboratorThemeSession(state, frontstageCollaboratorId)),
    setCollectionProjectId: (collectionProjectId: string | null) => set({ collectionProjectId }),
    setEditingCollaboratorId: (editingCollaboratorId: string | null) => set({ editingCollaboratorId }),
    setScreenshotDebugOverlayEnabled: (screenshotDebugOverlayEnabled: boolean) => set({ screenshotDebugOverlayEnabled }),
    setAppLanguage: (appLanguage) => set({ appLanguage }),
    setDisplayPreferences: (patch) =>
      set((state) => ({
        displayPreferences: mergeDisplayPreferencesPatch(state.displayPreferences, patch)
      })),
    setFocusedMessageTarget: (focusedMessageTarget) => set({ focusedMessageTarget }),
    setActiveCard: (activeCardId) => set({ activeCardId }),
    spotlightCard: (spotlightCardId) => set({ spotlightCardId }),
    clearSpotlightCard: (cardId) =>
      set((state) => ({
        spotlightCardId:
          !cardId || state.spotlightCardId === cardId
            ? null
            : state.spotlightCardId
      })),
    setPendingProjectOpenId: (pendingProjectOpenId) => set({ pendingProjectOpenId }),
    setPendingProjectOpenSource: (pendingProjectOpenSource) => set({ pendingProjectOpenSource }),
    setPendingCardReference: (pendingCardReference) => set({ pendingCardReference }),
    clearPendingCardReference: () => set({ pendingCardReference: null }),
    addPendingAttachments: (attachments) =>
      set((state) => ({
        pendingAttachments: [...state.pendingAttachments, ...attachments]
      })),
    removePendingAttachment: (attachmentId) =>
      set((state) => ({
        pendingAttachments: state.pendingAttachments.filter((attachment) => attachment.id !== attachmentId)
      })),
    clearPendingAttachments: () => set({ pendingAttachments: [] }),
    enqueueReplyNotification: (notification) =>
      set((state) => ({
        replyNotifications: [
          ...state.replyNotifications.filter((entry) => entry.conversationId !== notification.conversationId),
          {
            ...notification,
            id: notification.id ?? createUid('reply-notification'),
            createdAt: notification.createdAt ?? Date.now()
          }
        ]
      })),
    dismissReplyNotification: (notificationId) =>
      set((state) => ({
        replyNotifications: state.replyNotifications.filter((entry) => entry.id !== notificationId)
      })),
    clearReplyNotifications: () => set({ replyNotifications: [] })
  };
}
