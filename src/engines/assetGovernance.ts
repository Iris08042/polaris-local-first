import { extractPolarisAssetIds } from './assetReferences';
import type {
  AppCustomization,
  ChatAttachment,
  CodeCard,
  Conversation,
  ImageAssetCard,
  Persona,
  ProjectFile,
  RoomProject,
  ThemeState,
  WorkspaceReferenceDoc
} from '../types/domain';
import {
  deleteActiveAssetPreviewEntry,
  deleteActiveAssetStorageEntries,
  listActiveAssetBinaryEntrySizes,
  listActiveAssetBinaryKeys,
  listActiveAssetMetaEntries,
  listActiveAssetPreviewEntrySizes,
  runExclusiveAssetMutation,
  type StoredAssetMeta
} from '../infrastructure/assetStore';

export type AssetGovernanceReferences = {
  conversations: Conversation[];
  codeCards?: CodeCard[];
  imageCards: ImageAssetCard[];
  projectFiles?: ProjectFile[];
  workspaceReferenceDocs?: WorkspaceReferenceDoc[];
  roomProjects?: RoomProject[];
  personas?: Persona[];
  theme?: ThemeState | null;
  collaboratorThemes?: Record<string, { theme: ThemeState; customization: AppCustomization }>;
  customization?: AppCustomization | null;
  pendingAttachments?: ChatAttachment[];
};

export type AssetAuditOwnerKind =
  | 'conversation'
  | 'conversation-voice-cache'
  | 'code-card'
  | 'image-card'
  | 'project-file'
  | 'workspace-reference-doc'
  | 'room-project'
  | 'pending-attachments'
  | 'persona'
  | 'runtime-customization'
  | 'theme';

export type AssetAuditOwnerSummary = {
  kind: AssetAuditOwnerKind;
  id: string;
  label: string;
  assetCount: number;
  binaryBytes: number;
  previewBytes: number;
  totalBytes: number;
  largestAssetId: string | null;
  largestAssetName: string | null;
  topAssets: AssetAuditEntry[];
};

export type AssetAuditEntry = {
  id: string;
  storageKind: 'asset' | 'preview-cache';
  kind: StoredAssetMeta['kind'] | 'unknown';
  name: string;
  createdAt: number | null;
  referenced: boolean;
  binaryBytes: number;
  previewBytes: number;
  totalBytes: number;
  hasMeta: boolean;
  hasBinary: boolean;
  hasPreview: boolean;
};

export type AssetAuditSummary = {
  referencedAssetIds: Set<string>;
  entries: AssetAuditEntry[];
  ownerSummaries: AssetAuditOwnerSummary[];
  totalAssetCount: number;
  referencedAssetCount: number;
  orphanAssetCount: number;
  imageCount: number;
  fileCount: number;
  totalBinaryBytes: number;
  totalPreviewBytes: number;
  totalBytes: number;
  orphanBinaryBytes: number;
  orphanPreviewBytes: number;
  orphanTotalBytes: number;
  orphanAssetIds: string[];
  orphanPreviewCacheCount: number;
  orphanPreviewCacheBytes: number;
  orphanPreviewCacheIds: string[];
  missingMetaAssetIds: string[];
  missingBinaryAssetIds: string[];
  largestAssets: AssetAuditEntry[];
  largestOwners: AssetAuditOwnerSummary[];
};

export type RedundantAssetPreviewAudit = {
  redundantPreviewAssetIds: string[];
  redundantPreviewBytes: number;
};

export type AssetReferenceOwner = {
  kind: AssetAuditOwnerKind;
  id: string;
  label: string;
};

export type AssetReferenceOwnersById = Map<string, AssetReferenceOwner[]>;

function collectAssetIdsFromAttachments(attachments: ChatAttachment[] | undefined, target: Set<string>) {
  attachments?.forEach((attachment) => {
    if (attachment.clearedAt) return;
    if (typeof attachment.assetId === 'string' && attachment.assetId.trim()) {
      target.add(attachment.assetId);
    }
  });
}

function collectVoiceCacheAssetId(message: Conversation['messages'][number], target: Set<string>) {
  const assetId = message.voiceCache?.assetId;
  if (typeof assetId === 'string' && assetId.trim()) {
    target.add(assetId);
  }
}

function recordOwnerAssetIds(
  assetIds: Set<string>,
  owner: AssetReferenceOwner,
  target: AssetReferenceOwnersById
) {
  assetIds.forEach((assetId) => {
    const owners = target.get(assetId) ?? [];
    owners.push(owner);
    target.set(assetId, owners);
  });
}

function collectAttachmentAssetIds(attachments: ChatAttachment[] | undefined) {
  const assetIds = new Set<string>();
  collectAssetIdsFromAttachments(attachments, assetIds);
  return assetIds;
}

function collectPersonaAvatarAssetIds(persona: Persona) {
  const assetIds = new Set<string>();

  if (typeof persona.assistantAvatarAssetId === 'string' && persona.assistantAvatarAssetId.trim()) {
    assetIds.add(persona.assistantAvatarAssetId);
  }
  if (typeof persona.userAvatarAssetId === 'string' && persona.userAvatarAssetId.trim()) {
    assetIds.add(persona.userAvatarAssetId);
  }

  return assetIds;
}

function collectCustomizationAssetIds(customization: AppCustomization | null | undefined) {
  const assetIds = new Set<string>();

  if (typeof customization?.backgroundAssetId === 'string' && customization.backgroundAssetId.trim()) {
    assetIds.add(customization.backgroundAssetId);
  }
  if (typeof customization?.coupleImageAssetId === 'string' && customization.coupleImageAssetId.trim()) {
    assetIds.add(customization.coupleImageAssetId);
  }
  customization?.customFontAssetIds?.forEach((assetId) => {
    if (assetId.trim()) assetIds.add(assetId);
  });

  return assetIds;
}

function collectTextAssetIds(...values: Array<string | undefined | null>) {
  const assetIds = new Set<string>();
  values.forEach((value) => {
    extractPolarisAssetIds(value).forEach((assetId) => {
      if (assetId.trim()) assetIds.add(assetId);
    });
  });
  return assetIds;
}

function collectThemeAssetIds(theme: ThemeState | null | undefined) {
  const assetIds = collectTextAssetIds(theme?.presetCSS, theme?.customCSS, theme?.generatedCSS);

  theme?.savedSkins?.forEach((skin) => {
    collectTextAssetIds(skin.presetCSS, skin.customCSS, skin.generatedCSS).forEach((assetId) => {
      assetIds.add(assetId);
    });
  });
  theme?.skinHistory?.forEach((snapshot) => {
    collectTextAssetIds(snapshot.presetCSS, snapshot.customCSS, snapshot.generatedCSS).forEach((assetId) => {
      assetIds.add(assetId);
    });
  });
  theme?.patchLedger?.forEach((entry) => {
    collectTextAssetIds(entry.detailText).forEach((assetId) => {
      assetIds.add(assetId);
    });
  });

  return assetIds;
}

export function collectAssetReferenceOwners({
  conversations,
  codeCards = [],
  imageCards,
  projectFiles = [],
  workspaceReferenceDocs = [],
  roomProjects = [],
  personas = [],
  theme = null,
  collaboratorThemes = {},
  customization = null,
  pendingAttachments = []
}: AssetGovernanceReferences): AssetReferenceOwnersById {
  const ownersByAssetId: AssetReferenceOwnersById = new Map();

  conversations.forEach((conversation) => {
    const attachmentAssetIds = new Set<string>();
    const voiceCacheAssetIds = new Set<string>();
    conversation.messages.forEach((message) => {
      collectAssetIdsFromAttachments(message.attachments, attachmentAssetIds);
      collectVoiceCacheAssetId(message, voiceCacheAssetIds);
    });

    if (attachmentAssetIds.size > 0) {
      recordOwnerAssetIds(attachmentAssetIds, {
        kind: 'conversation',
        id: conversation.id,
        label: conversation.title.trim() || conversation.id
      }, ownersByAssetId);
    }
    if (voiceCacheAssetIds.size > 0) {
      recordOwnerAssetIds(voiceCacheAssetIds, {
        kind: 'conversation-voice-cache',
        id: conversation.id,
        label: conversation.title.trim() || conversation.id
      }, ownersByAssetId);
    }
  });

  codeCards.forEach((card) => {
    const assetIds = collectTextAssetIds(card.code, card.cardFaceCss, card.cardNote);
    if (assetIds.size === 0) return;
    recordOwnerAssetIds(assetIds, {
      kind: 'code-card',
      id: card.id,
      label: card.title.trim() || card.id
    }, ownersByAssetId);
  });

  imageCards.forEach((card) => {
    if (!card.assetId.trim()) return;
    recordOwnerAssetIds(new Set([card.assetId]), {
      kind: 'image-card',
      id: card.id,
      label: card.title.trim() || card.id
    }, ownersByAssetId);
  });

  projectFiles.forEach((file) => {
    const assetIds = collectTextAssetIds(file.content);
    if (assetIds.size === 0) return;
    recordOwnerAssetIds(assetIds, {
      kind: 'project-file',
      id: file.id,
      label: file.filePath.trim() || file.id
    }, ownersByAssetId);
  });

  workspaceReferenceDocs.forEach((doc) => {
    const assetIds = collectTextAssetIds(doc.content, doc.summary);
    if (assetIds.size === 0) return;
    recordOwnerAssetIds(assetIds, {
      kind: 'workspace-reference-doc',
      id: doc.id,
      label: doc.title.trim() || doc.id
    }, ownersByAssetId);
  });

  roomProjects.forEach((project) => {
    const assetIds = collectTextAssetIds(project.coverStyle, project.coverNote);
    if (assetIds.size === 0) return;
    recordOwnerAssetIds(assetIds, {
      kind: 'room-project',
      id: project.id,
      label: project.title.trim() || project.id
    }, ownersByAssetId);
  });

  const pendingAssetIds = collectAttachmentAssetIds(pendingAttachments);
  if (pendingAssetIds.size > 0) {
    recordOwnerAssetIds(pendingAssetIds, {
      kind: 'pending-attachments',
      id: 'pending-attachments',
      label: '待发送附件'
    }, ownersByAssetId);
  }

  personas.forEach((persona) => {
    const assetIds = collectPersonaAvatarAssetIds(persona);
    if (assetIds.size === 0) return;
    recordOwnerAssetIds(assetIds, {
      kind: 'persona',
      id: persona.id,
      label: persona.name.trim() || persona.id
    }, ownersByAssetId);
  });

  const customizationAssetIds = collectCustomizationAssetIds(customization);
  if (customizationAssetIds.size > 0) {
    recordOwnerAssetIds(customizationAssetIds, {
      kind: 'runtime-customization',
      id: 'runtime-customization',
      label: '运行时自定义'
    }, ownersByAssetId);
  }

  const themeAssetIds = collectThemeAssetIds(theme);
  if (themeAssetIds.size > 0) {
    recordOwnerAssetIds(themeAssetIds, {
      kind: 'theme',
      id: 'theme',
      label: '当前皮肤'
    }, ownersByAssetId);
  }

  Object.entries(collaboratorThemes).forEach(([collaboratorId, session]) => {
    const sessionThemeAssetIds = collectThemeAssetIds(session.theme);
    if (sessionThemeAssetIds.size > 0) {
      recordOwnerAssetIds(sessionThemeAssetIds, {
        kind: 'theme',
        id: `theme:${collaboratorId}`,
        label: `协作者皮肤 ${collaboratorId}`
      }, ownersByAssetId);
    }

    const sessionCustomizationAssetIds = collectCustomizationAssetIds(session.customization);
    if (sessionCustomizationAssetIds.size > 0) {
      recordOwnerAssetIds(sessionCustomizationAssetIds, {
        kind: 'runtime-customization',
        id: `runtime-customization:${collaboratorId}`,
        label: `协作者自定义 ${collaboratorId}`
      }, ownersByAssetId);
    }
  });

  return ownersByAssetId;
}

export function collectReferencedAssetIds({
  conversations,
  codeCards = [],
  imageCards,
  projectFiles = [],
  workspaceReferenceDocs = [],
  roomProjects = [],
  personas = [],
  theme = null,
  collaboratorThemes = {},
  customization = null,
  pendingAttachments = []
}: AssetGovernanceReferences): Set<string> {
  const referencedAssetIds = new Set<string>();

  conversations.forEach((conversation) => {
    conversation.messages.forEach((message) => {
      collectAssetIdsFromAttachments(message.attachments, referencedAssetIds);
      collectVoiceCacheAssetId(message, referencedAssetIds);
    });
  });

  codeCards.forEach((card) => {
    collectTextAssetIds(card.code, card.cardFaceCss, card.cardNote).forEach((assetId) => {
      referencedAssetIds.add(assetId);
    });
  });

  imageCards.forEach((card) => {
    if (typeof card.assetId === 'string' && card.assetId.trim()) {
      referencedAssetIds.add(card.assetId);
    }
  });

  projectFiles.forEach((file) => {
    collectTextAssetIds(file.content).forEach((assetId) => {
      referencedAssetIds.add(assetId);
    });
  });
  workspaceReferenceDocs.forEach((doc) => {
    collectTextAssetIds(doc.content, doc.summary).forEach((assetId) => {
      referencedAssetIds.add(assetId);
    });
  });
  roomProjects.forEach((project) => {
    collectTextAssetIds(project.coverStyle, project.coverNote).forEach((assetId) => {
      referencedAssetIds.add(assetId);
    });
  });
  collectAssetIdsFromAttachments(pendingAttachments, referencedAssetIds);
  personas.forEach((persona) => {
    collectPersonaAvatarAssetIds(persona).forEach((assetId) => {
      referencedAssetIds.add(assetId);
    });
  });
  collectCustomizationAssetIds(customization).forEach((assetId) => {
    referencedAssetIds.add(assetId);
  });
  collectThemeAssetIds(theme).forEach((assetId) => {
    referencedAssetIds.add(assetId);
  });
  Object.values(collaboratorThemes).forEach((session) => {
    collectThemeAssetIds(session.theme).forEach((assetId) => {
      referencedAssetIds.add(assetId);
    });
    collectCustomizationAssetIds(session.customization).forEach((assetId) => {
      referencedAssetIds.add(assetId);
    });
  });

  return referencedAssetIds;
}

export function collectConversationOnlyAssetIds(references: AssetGovernanceReferences): Set<string> {
  const ownersByAssetId = collectAssetReferenceOwners(references);
  const conversationOnlyAssetIds = new Set<string>();

  ownersByAssetId.forEach((owners, assetId) => {
    if (owners.length > 0 && owners.every((owner) => owner.kind === 'conversation')) {
      conversationOnlyAssetIds.add(assetId);
    }
  });

  return conversationOnlyAssetIds;
}

export function buildAssetAuditSummary(params: {
  referencedAssetIds: Set<string>;
  referenceOwnersByAssetId?: AssetReferenceOwnersById;
  metaById: Map<string, StoredAssetMeta>;
  binarySizeById: Map<string, number>;
  previewSizeById: Map<string, number>;
}): AssetAuditSummary {
  const {
    referencedAssetIds,
    referenceOwnersByAssetId = new Map(),
    metaById,
    binarySizeById,
    previewSizeById
  } = params;
  const allAssetIds = new Set<string>([
    ...metaById.keys(),
    ...binarySizeById.keys(),
    ...previewSizeById.keys()
  ]);

  const entries = [...allAssetIds].map((assetId) => {
    const meta = metaById.get(assetId) ?? null;
    const binaryBytes = binarySizeById.get(assetId) ?? 0;
    const previewBytes = previewSizeById.get(assetId) ?? 0;
    const hasMeta = meta !== null;
    const hasBinary = binarySizeById.has(assetId);
    const hasPreview = previewSizeById.has(assetId);
    const referenced = referencedAssetIds.has(assetId);
    const storageKind = !referenced && !hasMeta && !hasBinary && hasPreview ? 'preview-cache' : 'asset';

    return {
      id: assetId,
      storageKind,
      kind: meta?.kind ?? 'unknown',
      name: meta?.name ?? assetId,
      createdAt: typeof meta?.createdAt === 'number' ? meta.createdAt : null,
      referenced,
      binaryBytes,
      previewBytes,
      totalBytes: binaryBytes + previewBytes,
      hasMeta,
      hasBinary,
      hasPreview
    } satisfies AssetAuditEntry;
  });

  const assetEntries = entries.filter((entry) => entry.storageKind === 'asset');
  const orphanEntries = assetEntries.filter((entry) => !entry.referenced);
  const orphanPreviewCacheEntries = entries.filter((entry) => entry.storageKind === 'preview-cache');
  const ownerEntriesByKey = new Map<string, {
    owner: AssetReferenceOwner;
    assets: AssetAuditEntry[];
  }>();

  entries.forEach((entry) => {
    const owners: AssetReferenceOwner[] = referenceOwnersByAssetId.get(entry.id) ?? [];
    owners.forEach((owner) => {
      const ownerKey = `${owner.kind}:${owner.id}`;
      const current = ownerEntriesByKey.get(ownerKey);
      if (current) {
        current.assets.push(entry);
        return;
      }

      ownerEntriesByKey.set(ownerKey, {
        owner,
        assets: [entry]
      });
    });
  });

  const ownerSummaries = [...ownerEntriesByKey.values()]
    .map(({ owner, assets }) => {
      const sortedAssets = [...assets].sort((left, right) => right.totalBytes - left.totalBytes);
      const largestAsset = sortedAssets[0] ?? null;

      return {
        kind: owner.kind,
        id: owner.id,
        label: owner.label,
        assetCount: assets.length,
        binaryBytes: assets.reduce((sum, asset) => sum + asset.binaryBytes, 0),
        previewBytes: assets.reduce((sum, asset) => sum + asset.previewBytes, 0),
        totalBytes: assets.reduce((sum, asset) => sum + asset.totalBytes, 0),
        largestAssetId: largestAsset?.id ?? null,
        largestAssetName: largestAsset?.name ?? null,
        topAssets: sortedAssets.slice(0, 3)
      } satisfies AssetAuditOwnerSummary;
    })
    .sort((left, right) => right.totalBytes - left.totalBytes);

  return {
    referencedAssetIds,
    entries,
    ownerSummaries,
    totalAssetCount: assetEntries.length,
    referencedAssetCount: assetEntries.length - orphanEntries.length,
    orphanAssetCount: orphanEntries.length,
    imageCount: assetEntries.filter((entry) => entry.kind === 'image').length,
    fileCount: assetEntries.filter((entry) => entry.kind === 'file').length,
    totalBinaryBytes: entries.reduce((sum, entry) => sum + entry.binaryBytes, 0),
    totalPreviewBytes: entries.reduce((sum, entry) => sum + entry.previewBytes, 0),
    totalBytes: entries.reduce((sum, entry) => sum + entry.totalBytes, 0),
    orphanBinaryBytes: orphanEntries.reduce((sum, entry) => sum + entry.binaryBytes, 0),
    orphanPreviewBytes: orphanEntries.reduce((sum, entry) => sum + entry.previewBytes, 0),
    orphanTotalBytes: [
      ...orphanEntries,
      ...orphanPreviewCacheEntries
    ].reduce((sum, entry) => sum + entry.totalBytes, 0),
    orphanAssetIds: orphanEntries.map((entry) => entry.id),
    orphanPreviewCacheCount: orphanPreviewCacheEntries.length,
    orphanPreviewCacheBytes: orphanPreviewCacheEntries.reduce((sum, entry) => sum + entry.previewBytes, 0),
    orphanPreviewCacheIds: orphanPreviewCacheEntries.map((entry) => entry.id),
    missingMetaAssetIds: assetEntries.filter((entry) => !entry.hasMeta).map((entry) => entry.id),
    missingBinaryAssetIds: assetEntries.filter((entry) => !entry.hasBinary).map((entry) => entry.id),
    largestAssets: [...assetEntries]
      .sort((left, right) => right.totalBytes - left.totalBytes)
      .slice(0, 5),
    largestOwners: ownerSummaries.slice(0, 5)
  };
}

export function resolveRedundantAssetPreviewAudit(params: {
  binarySizeById: Map<string, number>;
  previewSizeById: Map<string, number>;
}): RedundantAssetPreviewAudit {
  const redundantPreviewEntries = [...params.previewSizeById.entries()].filter(([assetId, previewBytes]) => {
    const binaryBytes = params.binarySizeById.get(assetId) ?? 0;
    return binaryBytes > 0 && previewBytes >= binaryBytes;
  });

  return {
    redundantPreviewAssetIds: redundantPreviewEntries.map(([assetId]) => assetId),
    redundantPreviewBytes: redundantPreviewEntries.reduce((sum, [, previewBytes]) => sum + previewBytes, 0)
  };
}

function buildBinarySizeHints(
  metaById: Map<string, StoredAssetMeta>,
  binaryIds: string[]
) {
  return new Map(binaryIds.map((assetId) => [assetId, metaById.get(assetId)?.size ?? 0]));
}

export async function auditRedundantAssetPreviews(): Promise<RedundantAssetPreviewAudit> {
  const [binarySizes, previewSizes] = await Promise.all([
    listActiveAssetBinaryEntrySizes(),
    listActiveAssetPreviewEntrySizes()
  ]);

  return resolveRedundantAssetPreviewAudit({
    binarySizeById: new Map(binarySizes.map((entry) => [entry.key, entry.size])),
    previewSizeById: new Map(previewSizes.map((entry) => [entry.key, entry.size]))
  });
}

export async function auditStoredAssets(references: AssetGovernanceReferences): Promise<AssetAuditSummary> {
  const referencedAssetIds = collectReferencedAssetIds(references);
  const referenceOwnersByAssetId = collectAssetReferenceOwners(references);
  const [metaEntries, binaryIds, previewSizes] = await Promise.all([
    listActiveAssetMetaEntries(),
    listActiveAssetBinaryKeys(),
    listActiveAssetPreviewEntrySizes()
  ]);
  const metaById = new Map(metaEntries.map((entry) => [entry.key, entry.value]));

  return buildAssetAuditSummary({
    referencedAssetIds,
    referenceOwnersByAssetId,
    metaById,
    binarySizeById: buildBinarySizeHints(metaById, binaryIds),
    previewSizeById: new Map(previewSizes.map((entry) => [entry.key, entry.size]))
  });
}

export async function sweepOrphanAssets(
  references: AssetGovernanceReferences,
  options: {
    candidateAssetIds?: Iterable<string>;
    candidatePreviewCacheIds?: Iterable<string>;
  } = {}
) {
  return await runExclusiveAssetMutation(async () => {
    const audit = await auditStoredAssets(references);
    const candidateAssetIds = options.candidateAssetIds ? new Set(options.candidateAssetIds) : null;
    const candidatePreviewCacheIds = options.candidatePreviewCacheIds ? new Set(options.candidatePreviewCacheIds) : null;
    const assetIdsToDelete = audit.orphanAssetIds.filter((assetId) =>
      !candidateAssetIds || candidateAssetIds.has(assetId)
    );
    const previewCacheIdsToDelete = audit.orphanPreviewCacheIds.filter((assetId) =>
      !candidatePreviewCacheIds || candidatePreviewCacheIds.has(assetId)
    );

    // Sequential, not Promise.all: under an active asset domain each deletion also reconciles the
    // asset row + domain meta in a read-modify-commit, so concurrent deletions would race the meta.
    for (const assetId of assetIdsToDelete) {
      await deleteActiveAssetStorageEntries(assetId);
    }
    for (const assetId of previewCacheIdsToDelete) {
      await deleteActiveAssetPreviewEntry(assetId);
    }

    return {
      audit,
      deletedAssetIds: assetIdsToDelete,
      deletedPreviewCacheIds: previewCacheIdsToDelete,
      deletedCount: assetIdsToDelete.length + previewCacheIdsToDelete.length
    };
  });
}

export async function sweepRedundantAssetPreviews() {
  return await runExclusiveAssetMutation(async () => {
    const audit = await auditRedundantAssetPreviews();

    // Sequential, not Promise.all: each preview deletion reconciles the active asset row + domain
    // meta in a read-modify-commit, so concurrent deletions would race the meta.
    for (const assetId of audit.redundantPreviewAssetIds) {
      await deleteActiveAssetPreviewEntry(assetId);
    }

    return {
      audit,
      deletedAssetIds: audit.redundantPreviewAssetIds,
      deletedCount: audit.redundantPreviewAssetIds.length,
      deletedBytes: audit.redundantPreviewBytes
    };
  });
}
