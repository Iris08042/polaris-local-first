export type World = 'collection' | 'chat';
export type CollectionShelf = 'info' | 'code' | 'project' | 'dialogue' | 'image';
export type WorkspaceChatReturnTarget = {
  world: 'chat';
  conversationId: string;
};
export type WorkspaceViewReturnTarget = WorkspaceChatReturnTarget | null;
export type ThemeToolScope = 'collection' | 'chat' | 'app';
export type ThemeSurfaceId = string;
export type ModelTier = 'small' | 'medium' | 'strong';
export type ThemeToolMode = 'off' | 'stable' | 'creative';
export type ThemeToolPatchMode = 'replace' | 'merge';
export type CodeCardFileRole = 'entry' | 'style' | 'logic' | 'content' | 'note' | 'asset-manifest';
export type RoomProjectSource = 'manual' | 'chat-generated' | 'imported';
export type ProjectFileSource = 'manual' | 'chat-generated' | 'imported';
export type WorkspaceReferenceDocSource = 'manual' | 'chat-generated' | 'imported';
export type ChatToolCallTransport = 'native' | 'fence' | 'recovered-code';
export type ChatToolCallSourceSpan = {
  transport: ChatToolCallTransport;
  index: number;
  blockIndex?: number;
};
export type ChatNativeToolCall = {
  id?: string;
  name: string;
  argumentsText: string;
  providerMetadata?: {
    geminiThoughtSignature?: string;
  };
  sourceSpan?: ChatToolCallSourceSpan;
};
export type ToolInvocationStatus = 'running' | 'preview' | 'applied' | 'rolled_back' | 'superseded' | 'executed' | 'saved' | 'failed';
export type PersonaBaseId =
  | 'blank'
  | 'subject'
  | 'null'
  | 'living'
  | 'executor'
  | 'guardian'
  | 'catgirl'
  | 'monday'
  | 'custom';
export type PersonaStackId = 'professional' | 'brief' | 'safe' | 'intimate' | 'humor' | 'delicate' | 'decisive';
export type PersonaRelationshipId = 'partner' | 'companion' | 'assistant' | 'roleplay';
export type PersonaExpressionId = 'reserved' | 'natural' | 'intimate' | 'unbounded';
export type PersonaTagGroupId = 'temperament' | 'interaction' | 'expression' | 'thinking' | 'action';
export type PersonaTagSelection = Record<PersonaTagGroupId, string[]>;
export type PersonaTemperamentId = 'lively' | 'steady' | 'sensitive' | 'brave' | 'gentle';
export type PersonaEmotionId = 'auto' | 'positive' | 'restrained' | 'soothing' | 'calm';
export type PersonaActionId = 'comfort_first' | 'conclusion_first' | 'parallel';
export type PersonaStabilityId = 'cooler' | 'softer' | 'direct';
export type PersonaWritingStyleId = 'balanced' | 'concise' | 'literary' | 'emotional';
export type PersonaGeneratedPromptMode = 'vnext' | 'off';
export type PersonaInitiativeId = 'reactive' | 'balanced' | 'proactive' | 'assertive';
export type PersonaMemoryStyleId = 'quiet' | 'callback' | 'weaving' | 'archival';
export type PersonaSilenceId = 'wait' | 'gentle_check' | 'fill' | 'mirror';
export type PersonaDisagreementId = 'defer' | 'soft_nudge' | 'honest' | 'confrontational';
export type PersonaHumorId = 'none' | 'dry' | 'warm' | 'absurd' | 'teasing';
export type PersonaAttachmentId = 'verbal' | 'acts' | 'presence' | 'physical' | 'protective';
export type PersonaCuriosityId = 'minimal' | 'respectful' | 'eager' | 'deep';
export type PersonaSelfDisclosureId = 'opaque' | 'selective' | 'reciprocal' | 'transparent';
export type AvatarShape = 'rounded' | 'circle';
export type AvatarDisplaySize = 'small' | 'medium' | 'large';
export type AvatarIconId =
  | 'openai'
  | 'claude'
  | 'deepseek'
  | 'gemini'
  | 'kimi'
  | 'mimo'
  | 'mistral'
  | 'perplexity'
  | 'qwen'
  | 'xai'
  | 'doubao';

