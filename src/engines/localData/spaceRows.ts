import type {
  AppCustomization,
  CollectionShelf,
  SavedSkin,
  ThemeState,
  World
} from '../../types/domain';
import type { CollaboratorThemeSession } from '../../stores/spaceStoreTypes';
import { extractPolarisAssetIds } from '../assetReferences';
import {
  type LocalDataRef,
  type LocalDataStoredRow,
  type LocalDataUnitMutation,
  type LocalDataUnitOfWork,
  type SpaceCustomizationRowValue,
  type SpaceDomainMetaRow,
  type SpaceFrontstageRowValue,
  type SpaceLocalDataObjectKind,
  type SpaceObjectRow,
  type SpaceObjectState,
  type SpaceObjectValueMap,
  type SpaceSkinRowValue,
  type SpaceThemeRowValue,
  createCompleteLocalDataRow
} from './types';

export const SPACE_OBJECT_LEGACY_LIFECYCLE_STATES = [
  'archive',
  'recovering',
  'quarantine',
  'missing-body'
] as const satisfies readonly SpaceObjectState[];

const SPACE_OBJECT_LEGACY_LIFECYCLE_STATE_SET = new Set<SpaceObjectState>(
  SPACE_OBJECT_LEGACY_LIFECYCLE_STATES
);

/** True when the space object row is a sealed legacy entry, not a live product object. */
export function isLegacyLifecycleSpaceState(state: SpaceObjectState | undefined): boolean {
  return state !== undefined && SPACE_OBJECT_LEGACY_LIFECYCLE_STATE_SET.has(state);
}

/** True when the space object row is a live, writable product object. */
export function isLiveProductSpaceState(state: SpaceObjectState | undefined): boolean {
  return state === undefined || state === 'active';
}

export type SpaceLocalDataState = {
  activeWorld: World;
  collectionShelf: CollectionShelf;
  frontstageCollaboratorId: string | null;
  collectionProjectId: string | null;
  editingCollaboratorId: string | null;
  screenshotDebugOverlayEnabled: boolean;
  appLanguage: SpaceFrontstageRowValue['appLanguage'];
  displayPreferences: SpaceFrontstageRowValue['displayPreferences'];
  activeCardId: string | null;
  theme: ThemeState;
  customization: AppCustomization;
  collaboratorThemes: Record<string, CollaboratorThemeSession>;
};

export type SpaceObjectSeed =
  | { kind: 'frontstage'; value: SpaceFrontstageRowValue }
  | { kind: 'theme'; value: SpaceThemeRowValue }
  | { kind: 'customization'; value: SpaceCustomizationRowValue }
  | { kind: 'collaborator-theme'; value: SpaceObjectValueMap['collaborator-theme'] }
  | { kind: 'skin'; value: SpaceSkinRowValue };

export type SpaceLocalDataProjection = {
  domainMetaRow: ReturnType<typeof buildSpaceDomainMetaLocalDataRow>;
  objectRows: Array<ReturnType<typeof buildSpaceObjectLocalDataRow>>;
};

export function getSpaceDomainMetaLocalDataRef(): LocalDataRef {
  return {
    domain: 'space',
    kind: 'domainMeta',
    id: 'space'
  };
}

export function getSpaceObjectLocalDataRef(kind: SpaceLocalDataObjectKind, id: string): LocalDataRef {
  return {
    domain: 'space',
    kind,
    id
  };
}

export function toSpaceObjectId(kind: SpaceLocalDataObjectKind, id: string) {
  return `${kind}:${id}`;
}

function uniqueSortedIds(values: Iterable<string | null | undefined>) {
  return Array.from(new Set(
    Array.from(values)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  )).sort();
}

function collectTextAssetRefs(...values: Array<string | undefined>) {
  const refs = new Set<string>();
  values.forEach((value) => {
    if (!value) return;
    extractPolarisAssetIds(value).forEach((assetId) => refs.add(assetId));
  });
  return refs;
}

// The theme row no longer carries the saved-skin library, so its asset refs no longer
// include saved-skin CSS — each skin row collects its own. (Collaborator-theme sessions
// keep an empty saved-skin library, so this also stays correct for them.)
function collectThemeAssetRefs(theme: ThemeState) {
  const refs = collectTextAssetRefs(theme.presetCSS, theme.customCSS, theme.generatedCSS);
  theme.skinHistory.forEach((snapshot) => {
    collectTextAssetRefs(snapshot.presetCSS, snapshot.customCSS, snapshot.generatedCSS).forEach((assetId) => refs.add(assetId));
  });
  theme.patchLedger.forEach((entry) => {
    collectTextAssetRefs(entry.detailText).forEach((assetId) => refs.add(assetId));
  });
  return uniqueSortedIds(refs);
}

function collectSkinAssetRefs(skin: SavedSkin) {
  return uniqueSortedIds(collectTextAssetRefs(skin.presetCSS, skin.customCSS, skin.generatedCSS));
}

function collectCustomizationAssetRefs(customization: AppCustomization) {
  return uniqueSortedIds([
    customization.backgroundAssetId,
    customization.coupleImageAssetId,
    ...customization.customFontAssetIds
  ]);
}

function resolveThemeUpdatedAt(theme: ThemeState, fallback: number) {
  const savedSkinTimes = theme.savedSkins.map((skin) => skin.updatedAt);
  const skinHistoryTimes = theme.skinHistory.map((snapshot) => snapshot.createdAt);
  const patchLedgerTimes = theme.patchLedger.map((entry) => entry.updatedAt);
  return Math.max(fallback, ...savedSkinTimes, ...skinHistoryTimes, ...patchLedgerTimes);
}

function buildFrontstageValue(state: SpaceLocalDataState, updatedAt: number): SpaceFrontstageRowValue {
  return {
    id: 'space-frontstage',
    activeWorld: state.activeWorld,
    collectionShelf: state.collectionShelf,
    frontstageCollaboratorId: state.frontstageCollaboratorId,
    collectionProjectId: state.collectionProjectId,
    editingCollaboratorId: state.editingCollaboratorId,
    screenshotDebugOverlayEnabled: state.screenshotDebugOverlayEnabled,
    appLanguage: state.appLanguage,
    displayPreferences: state.displayPreferences,
    activeCardId: state.activeCardId,
    updatedAt
  };
}

function buildThemeValue(theme: ThemeState, updatedAt: number): SpaceThemeRowValue {
  const savedSkinOrder = theme.savedSkins.map((skin) => skin.id);
  return {
    id: 'space-theme',
    // Strip the saved-skin library from the stored ThemeState — it lives in skin rows.
    value: { ...theme, savedSkins: [] },
    savedSkinOrder,
    savedSkinCount: savedSkinOrder.length,
    skinHistoryCount: theme.skinHistory.length,
    patchLedgerCount: theme.patchLedger.length,
    assetRefs: collectThemeAssetRefs(theme),
    updatedAt: resolveThemeUpdatedAt(theme, updatedAt)
  };
}

function buildSkinValue(skin: SavedSkin): SpaceSkinRowValue {
  return {
    id: skin.id,
    value: skin,
    assetRefs: collectSkinAssetRefs(skin),
    updatedAt: skin.updatedAt
  };
}

function buildCustomizationValue(customization: AppCustomization, updatedAt: number): SpaceCustomizationRowValue {
  return {
    id: 'space-customization',
    value: customization,
    assetRefs: collectCustomizationAssetRefs(customization),
    updatedAt
  };
}

function buildCollaboratorThemeValue(
  collaboratorId: string,
  session: CollaboratorThemeSession,
  updatedAt: number
): SpaceObjectValueMap['collaborator-theme'] {
  const themeAssetRefs = collectThemeAssetRefs(session.theme);
  const customizationAssetRefs = collectCustomizationAssetRefs(session.customization);
  return {
    id: collaboratorId,
    collaboratorId,
    theme: session.theme,
    customization: session.customization,
    assetRefs: uniqueSortedIds([...themeAssetRefs, ...customizationAssetRefs]),
    updatedAt: resolveThemeUpdatedAt(session.theme, updatedAt)
  };
}

export function buildSpaceObjectSeeds(state: SpaceLocalDataState, updatedAt: number): SpaceObjectSeed[] {
  return [
    { kind: 'frontstage', value: buildFrontstageValue(state, updatedAt) },
    { kind: 'theme', value: buildThemeValue(state.theme, updatedAt) },
    { kind: 'customization', value: buildCustomizationValue(state.customization, updatedAt) },
    ...Object.entries(state.collaboratorThemes).map(([collaboratorId, session]) => ({
      kind: 'collaborator-theme' as const,
      value: buildCollaboratorThemeValue(collaboratorId, session, updatedAt)
    })),
    ...state.theme.savedSkins.map((skin) => ({
      kind: 'skin' as const,
      value: buildSkinValue(skin)
    }))
  ];
}

function resolveOwnerCollaboratorId(seed: SpaceObjectSeed) {
  return seed.kind === 'collaborator-theme' ? seed.value.collaboratorId : null;
}

function resolveAssetRefs(seed: SpaceObjectSeed) {
  if (seed.kind === 'frontstage') return [];
  return seed.value.assetRefs;
}

export function buildSpaceObjectLocalDataRow<K extends SpaceLocalDataObjectKind>(args: {
  kind: K;
  value: SpaceObjectValueMap[K];
  version: number;
  updatedAt: number;
}) {
  const seed = args as SpaceObjectSeed & { version: number; updatedAt: number };
  const rowValue: SpaceObjectRow<K> = {
    id: args.value.id,
    objectId: toSpaceObjectId(args.kind, args.value.id),
    kind: args.kind,
    value: args.value,
    ownerCollaboratorId: resolveOwnerCollaboratorId(seed),
    assetRefs: resolveAssetRefs(seed),
    updatedAt: args.value.updatedAt
  };

  return createCompleteLocalDataRow({
    ref: getSpaceObjectLocalDataRef(args.kind, args.value.id),
    value: rowValue,
    version: args.version,
    // The row ENVELOPE is stamped at the commit wall-clock (args.updatedAt); the row VALUE keeps
    // its content-derived `updatedAt`. The value diff zeroes every `updatedAt` level, so this does
    // not disturb change detection.
    updatedAt: args.updatedAt
  });
}

export function buildSpaceDomainMetaLocalDataRow(args: {
  state: SpaceLocalDataState;
  version: number;
  updatedAt: number;
}) {
  const objectCounts: SpaceDomainMetaRow['objectCounts'] = {
    frontstage: 1,
    theme: 1,
    customization: 1,
    'collaborator-theme': Object.keys(args.state.collaboratorThemes).length,
    skin: args.state.theme.savedSkins.length
  };
  const totalObjectCount = Object.values(objectCounts).reduce((sum, count) => sum + count, 0);
  const value: SpaceDomainMetaRow = {
    id: 'space',
    frontstageCollaboratorId: args.state.frontstageCollaboratorId,
    collectionProjectId: args.state.collectionProjectId,
    activeObjectCount: totalObjectCount,
    totalObjectCount,
    objectCounts,
    updatedAt: args.updatedAt
  };

  return createCompleteLocalDataRow({
    ref: getSpaceDomainMetaLocalDataRef(),
    value,
    version: args.version,
    updatedAt: args.updatedAt
  });
}

export function buildSpaceLocalDataProjection(args: {
  state: SpaceLocalDataState;
  version: number;
  updatedAt: number;
}): SpaceLocalDataProjection {
  return {
    domainMetaRow: buildSpaceDomainMetaLocalDataRow(args),
    objectRows: buildSpaceObjectSeeds(args.state, args.updatedAt).map((seed) => buildSpaceObjectLocalDataRow({
      ...seed,
      version: args.version,
      updatedAt: args.updatedAt
    }))
  };
}

export function buildSpaceLocalDataUnitOfWork(args: {
  id?: string;
  state: SpaceLocalDataState;
  version: number;
  updatedAt: number;
}): LocalDataUnitOfWork {
  const projection = buildSpaceLocalDataProjection(args);
  const objectMutations: LocalDataUnitMutation[] = projection.objectRows.map((row) => ({ type: 'put', row }));

  return {
    id: args.id,
    domain: 'space',
    version: args.version,
    mutations: [
      { type: 'put', row: projection.domainMetaRow },
      ...objectMutations
    ]
  };
}
