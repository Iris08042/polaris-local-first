import type { CollectionShelf, World } from '../types/domain';
import type { SpaceFrontstageState } from './spaceStoreTypes';
import { normalizeDisplayPreferences } from './spaceStoreDisplayPreferences';
import { normalizeAppLanguage, type AppLanguage } from '../i18n/appLanguage';

export const SPACE_FRONTSTAGE_SCHEMA_VERSION = 6;

type PersistedLegacySpaceFrontstageFields = Partial<{
  activeWorld: World | 'group';
  collectionShelf: 'info' | 'code' | 'project' | 'dialogue' | 'image' | 'group';
  frontstageCollaboratorId: string | null;
  chatProjectId: string | null;
  frontstageProjectId: string | null;
  collectionProjectId: string | null;
  currentCollaboratorId: string | null;
  editingCollaboratorId: string | null;
  screenshotDebugOverlayEnabled: boolean;
  appLanguage: unknown;
  displayPreferences: unknown;
  activeCardId: string | null;
}>;

export type PersistedSpaceFrontstageState = PersistedLegacySpaceFrontstageFields & {
  frontstageSchemaVersion?: number;
};

type MigratedSpaceFrontstageState = {
  activeWorld: World;
  collectionShelf: CollectionShelf;
  frontstageCollaboratorId: string | null;
  collectionProjectId: string | null;
  editingCollaboratorId: string | null;
  screenshotDebugOverlayEnabled: boolean;
  appLanguage: AppLanguage;
  displayPreferences: SpaceFrontstageState['displayPreferences'];
  activeCardId: string | null;
  pendingProjectOpenId: null;
  pendingProjectOpenSource: null;
  pendingCardReference: null;
  pendingAttachments: [];
};

export function serializePersistedSpaceFrontstageState(
  state: Pick<
    SpaceFrontstageState,
    'activeWorld' | 'collectionShelf' | 'frontstageCollaboratorId' | 'collectionProjectId' | 'editingCollaboratorId' | 'screenshotDebugOverlayEnabled' | 'appLanguage' | 'displayPreferences' | 'activeCardId'
  >
): PersistedSpaceFrontstageState {
  return {
    frontstageSchemaVersion: SPACE_FRONTSTAGE_SCHEMA_VERSION,
    activeWorld: state.activeWorld,
    collectionShelf: state.collectionShelf,
    frontstageCollaboratorId: state.frontstageCollaboratorId,
    collectionProjectId: state.collectionProjectId,
    editingCollaboratorId: state.editingCollaboratorId,
    screenshotDebugOverlayEnabled: state.screenshotDebugOverlayEnabled,
    appLanguage: normalizeAppLanguage(state.appLanguage),
    displayPreferences: normalizeDisplayPreferences(state.displayPreferences),
    activeCardId: state.activeCardId
  };
}

export function migratePersistedSpaceFrontstageState(
  persistedState: PersistedSpaceFrontstageState | null | undefined
): MigratedSpaceFrontstageState {
  const state = persistedState ?? {};
  const isCurrentSchema = state.frontstageSchemaVersion === SPACE_FRONTSTAGE_SCHEMA_VERSION;
  const displayPreferences = normalizeDisplayPreferences(state.displayPreferences);
  const legacyGroupShelf = state.collectionShelf === 'group';

  return {
    activeWorld:
      state.activeWorld === 'chat'
        ? 'chat'
        : state.activeWorld === 'group'
          ? 'chat'
          : 'collection',
    collectionShelf:
      legacyGroupShelf
        ? 'info'
        : state.collectionShelf === 'info'
        ? 'info'
        : state.collectionShelf === 'dialogue'
          ? 'dialogue'
          : state.collectionShelf === 'project'
            ? 'project'
            : state.collectionShelf === 'image'
            ? 'image'
            : 'code',
    frontstageCollaboratorId:
      typeof state.frontstageCollaboratorId === 'string' && state.frontstageCollaboratorId.trim()
        ? state.frontstageCollaboratorId
        : !isCurrentSchema && typeof state.currentCollaboratorId === 'string' && state.currentCollaboratorId.trim()
          ? state.currentCollaboratorId
          : null,
    collectionProjectId:
      typeof state.collectionProjectId === 'string' && state.collectionProjectId.trim()
        ? state.collectionProjectId
        : null,
    editingCollaboratorId:
      typeof state.editingCollaboratorId === 'string' && state.editingCollaboratorId.trim()
        ? state.editingCollaboratorId
        : null,
    screenshotDebugOverlayEnabled: state.screenshotDebugOverlayEnabled === true,
    appLanguage: normalizeAppLanguage(state.appLanguage),
    displayPreferences: isCurrentSchema
      ? displayPreferences
      : { ...displayPreferences, hapticsEnabled: false },
    activeCardId:
      typeof state.activeCardId === 'string' && state.activeCardId.trim()
        ? state.activeCardId
        : null,
    pendingProjectOpenId: null,
    pendingProjectOpenSource: null,
    pendingCardReference: null,
    pendingAttachments: []
  };
}
