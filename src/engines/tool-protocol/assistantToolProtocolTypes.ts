import type {
  CodeCard,
  CollectionShelf,
  ConversationTaskMode,
  ImageAssetCard,
  McpServerConfig,
  ModelTier,
  ProjectFile,
  ThemeRecipeMeta,
  ThemeToolMode,
  ToolInvocationKind,
  ThemeVariables,
  World,
  WorkspaceReferenceDoc
} from '../../types/domain';
export type { AssistantToolAction } from '../toolActionTypes';
import type { ThemeSelectorHint } from './themeSelectorPromptCatalog';
import type { McpResolvedToolDefinition } from '../mcpRuntime';
import type { RoomProjectTreeSnapshot } from '../roomProjects';
import type { RuntimeFeedbackEvent } from '../runtime-feedback/runtimeFeedbackEvents';
import type { PendingWorkspaceProposal } from '../workspaceBinding';
import type { WorkContextProjection } from '../workContext';

type StableSurfaceSnapshot = {
  surfaceCode: string;
  surfaceLabel: string;
  currentSpec: {
    hue: number;
    saturation: number;
    lightness: number;
    opacity: number;
    radius: number;
    borderW: number;
    blur: number;
    shadowDepth: number;
    texture: string;
    gradientMode: string;
    gradientAngle: number;
    accentHue: number;
  };
};

type StableSurfaceSnapshotSummary = {
  focusSource: 'user-hint' | 'selected' | 'recent-tool' | 'world-default';
  includedSurfaceCodes: string[];
  includedSurfaceLabels: string[];
  summarizedSurfaceCodes: string[];
  summarizedSurfaceLabels: string[];
};

export type AssistantToolContextMode = 'none' | 'summary' | 'focused';
export type AssistantToolEnforcementScope = 'theme-only';
export type PolarisToolPromptGroup =
  | 'environment'
  | 'task'
  | 'room'
  | 'project'
  | 'desktop'
  | 'theme'
  | 'attachment'
  | 'generation'
  | 'archive'
  | 'web'
  | 'personalData'
  | 'mcp'
  | 'knowledge'
  | 'memory'
  | 'memoryRecall'
  | 'memoryWrite'
  | 'proactive';
export type PolarisToolPromptPreferences = Partial<Record<PolarisToolPromptGroup, boolean>>;
export type RunCodeSandboxProfile = 'safe' | 'experimental';

export type AssistantToolContext = {
  activeCard: CodeCard | null;
  activeCardReferenceMode?: 'continue' | 'reference' | 'ambient';
  visibleCards: CodeCard[];
  visibleProjectFiles?: ProjectFile[];
  visibleWorkspaceReferenceDocs?: WorkspaceReferenceDoc[];
  activeProject?: RoomProjectTreeSnapshot | null;
  visibleProjects?: RoomProjectTreeSnapshot[];
  workContext?: WorkContextProjection;
  roomContextMode?: 'active' | 'available';
  retrievedCards?: Array<{
    id: string;
    title: string;
    language: string;
    tags: string[];
    originLabel: string | null;
  }>;
  themeContextMode?: AssistantToolContextMode;
  themeFocus?: {
    scopeLabel?: string;
    recentSurfaceLabels?: string[];
    recentSummary?: string;
    avoidGlobalPreset?: boolean;
  };
  themeModeSwitchHint?: {
    from: ThemeToolMode;
    to: ThemeToolMode;
  };
  recentToolHistory?: {
    kind: ToolInvocationKind;
    title: string;
    summary?: string;
    targetLabel?: string;
    status: 'executed' | 'applied' | 'saved';
  };
  uiSnapshot?: {
    activeWorld: World;
    collectionShelf: CollectionShelf;
    activeConversationTitle?: string;
    activeCollaboratorName?: string;
    chatAvatarLayoutEnabled?: boolean;
    selectorHints?: ThemeSelectorHint[];
  };
  attachmentSnapshot?: {
    latest: Array<{
      id: string;
      assetId?: string;
      kind: 'image' | 'file';
      name: string;
      mimeType?: string;
    }>;
    available: Array<{
      id: string;
      assetId?: string;
      kind: 'image' | 'file';
      name: string;
      mimeType?: string;
    }>;
  };
  imageAssetSnapshot?: {
    available: Array<{
      id: string;
      assetId: string;
      title: string;
      tags: string[];
      source: ImageAssetCard['source'];
      cssUrl: string;
    }>;
  };
  mcpServers?: McpServerConfig[];
  mcpToolTimeoutSeconds?: number;
  mcpTools?: McpResolvedToolDefinition[];
  mcpCatalogErrors?: string[];
  ombreBreathRequired?: boolean;
  desktopLocalHost?: {
    available: boolean;
    platform: string;
    permissionMode: 'confirm-each' | 'trusted';
    trustedRoots: Array<{
      id: string;
      label: string;
      path: string;
      lastUsedAt: number | null;
    }>;
  };
  personalData?: {
    calendarAvailable: boolean;
    calendarWriteAvailable?: boolean;
    calendarPermission?: string;
    platform?: string;
  };

  modelTier?: ModelTier;
  taskMode?: ConversationTaskMode;
  runCodeSandboxProfile?: RunCodeSandboxProfile;
  imageGenerationAvailable?: boolean;
  memorySearchAvailable?: boolean;
  enabledToolGroups?: PolarisToolPromptPreferences;
  themeToolMode?: ThemeToolMode;
  stableSurfaceSnapshots?: StableSurfaceSnapshot[];
  focusedSurfaceSnapshot?: {
    surfaceCode: string;
    surfaceLabel: string;
    currentSpec: {
      hue: number;
      saturation: number;
      lightness: number;
      opacity: number;
      radius: number;
      borderW: number;
      blur: number;
      shadowDepth: number;
      texture: string;
      gradientMode: string;
      gradientAngle: number;
      accentHue: number;
    };
  };
  stableSurfaceSnapshotSummary?: StableSurfaceSnapshotSummary;
  toolEnforcementMode?: 'normal' | 'force';
  toolEnforcementScope?: AssistantToolEnforcementScope;
  themePreviewActive?: boolean;
  themeSnapshot?: {
    activePresetId: string | null;
    activeSavedSkinId: string | null;
    cssVariables: ThemeVariables;
    presetCSS: string;
    customCSS: string;
    generatedCSS: string;
    recipe?: ThemeRecipeMeta;
  };
  runtimeFeedback?: {
    pendingWorkspaceProposal?: PendingWorkspaceProposal | null;
    events?: RuntimeFeedbackEvent[];
  };
};
