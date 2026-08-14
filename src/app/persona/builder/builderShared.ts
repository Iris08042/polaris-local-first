import { getPersonaBaseOption } from '../../../config/persona/personaBaseCatalog';
import { normalizePersonaBaseForBuilder, personaBaseLabel } from '../../../config/persona/personaBuilder';
import { createEmptyPersonaTags } from '../../../config/persona/personaTags';
import { resolvePersonaTags } from '../../../engines/personaTagResolver';
import type { CodeCard, Persona } from '../../../types/domain';
import type { PersonaUpdatePatch } from '../personaUpdatePatch';

export type PersonaBuilderVibeSelection = {
  useId: 'execution' | 'human';
  humanBaseId: 'subject' | 'blank';
  layerIds: string[];
  caseId?: string | null;
  casePrompt?: string;
};

export type PersonaBuilderDraft = Pick<
  Persona,
  | 'name'
  | 'description'
  | 'purpose'
  | 'baseId'
  | 'relationship'
  | 'expression'
  | 'tags'
  | 'initiative'
  | 'memoryStyle'
  | 'silence'
  | 'disagreement'
  | 'humor'
  | 'attachment'
  | 'curiosity'
  | 'selfDisclosure'
> & {
  deepDefinition: Persona['deepDefinition'];
  vibeSelection: PersonaBuilderVibeSelection;
};

export type PersonaBuilderHandoff = {
  summary: string;
  compiledPrompt: string;
  effectivePrompt: string;
  effectiveSource: 'custom' | 'vnext';
  runtimeNote: string;
  introCard: PersonaBuilderIntroCardSeed;
};

export type PersonaBuilderIntroCardSeed = Pick<
  CodeCard,
  'title' | 'cardNote' | 'language' | 'code' | 'cardFaceCss' | 'tags' | 'source'
>;

export const PERSONA_BUILDER_DEEP_FIELDS = [
  ['identityHint', '你想让 TA 像谁', '一个什么样的存在'],
  ['missionHint', 'TA 为什么在这里', '它存在是为了什么'],
  ['conflictPriority', '关系和任务冲突时', '先保什么'],
  ['conflictReason', '为什么', '这条优先级成立的原因'],
  ['avoidBecoming', '不该变成什么', '最该避免的样子'],
  ['correctiveAction', '一旦偏掉怎么办', '拉回来的动作'],
  ['vulnerableFirst', '你脆弱时先做什么', '先接住哪一层'],
  ['vulnerableThen', '然后做什么', '第二步怎样陪你'],
  ['hardBoundary', '硬边界', '绝不能越过什么'],
  ['hardBoundaryAction', '触边界后的动作', '一旦触发要怎么退回']
] as const;

export type PersonaBuilderDeepFieldKey = (typeof PERSONA_BUILDER_DEEP_FIELDS)[number][0];

export const PERSONA_BUILDER_DEEP_SECTIONS: Array<{
  id: string;
  title: string;
  note: string;
  fields: PersonaBuilderDeepFieldKey[];
}> = [
  {
    id: 'identity',
    title: '身份与使命',
    note: '先把 TA 是谁、为什么在这里定住。',
    fields: ['identityHint', 'missionHint']
  },
  {
    id: 'conflict',
    title: '冲突与自我修正',
    note: '当关系、任务和偏移撞在一起时，TA 怎么选、怎么拉回来。',
    fields: ['conflictPriority', 'conflictReason', 'avoidBecoming', 'correctiveAction']
  },
  {
    id: 'vulnerability',
    title: '脆弱时怎么接住你',
    note: '把陪伴动作写成有顺序的反应，而不是一句空话。',
    fields: ['vulnerableFirst', 'vulnerableThen']
  },
  {
    id: 'boundary',
    title: '边界',
    note: '最后定住不能越过的线，以及触线后怎么退。',
    fields: ['hardBoundary', 'hardBoundaryAction']
  }
];

export function countFilledDeepFields(
  draft: PersonaBuilderDraft,
  fields: PersonaBuilderDeepFieldKey[]
): number {
  return fields.reduce((total, field) => total + (draft.deepDefinition[field].trim() ? 1 : 0), 0);
}

export function createPersonaBuilderDraft(persona: Persona | null): PersonaBuilderDraft {
  const tags = persona
    ? resolvePersonaTags(persona as Persona)
    : createEmptyPersonaTags();
  const baseId = normalizePersonaBaseForBuilder(persona?.baseId ?? 'subject');
  const humanBaseId = baseId === 'blank' ? baseId : 'subject';
  const looksLikeExecutionPersona = persona?.initiative === 'assertive'
    && persona.memoryStyle === 'archival'
    && tags.interaction.includes('guiding')
    && tags.action.includes('push');
  const useId = baseId === 'monday' || looksLikeExecutionPersona
    ? 'execution'
    : 'human';

  return {
    name: persona?.name ?? '',
    description: persona?.description ?? '',
    purpose: persona?.purpose ?? '',
    baseId,
    relationship: persona?.relationship ?? 'partner',
    expression: persona?.expression ?? 'natural',
    tags,
    initiative: persona?.initiative ?? 'balanced',
    memoryStyle: persona?.memoryStyle ?? 'callback',
    silence: persona?.silence ?? 'mirror',
    disagreement: persona?.disagreement ?? 'honest',
    humor: persona?.humor ?? 'none',
    attachment: persona?.attachment ?? 'presence',
    curiosity: persona?.curiosity ?? 'respectful',
    selfDisclosure: persona?.selfDisclosure ?? 'selective',
    deepDefinition: {
      identityHint: persona?.deepDefinition.identityHint ?? '',
      missionHint: persona?.deepDefinition.missionHint ?? '',
      conflictPriority: persona?.deepDefinition.conflictPriority ?? '',
      conflictReason: persona?.deepDefinition.conflictReason ?? '',
      avoidBecoming: persona?.deepDefinition.avoidBecoming ?? '',
      correctiveAction: persona?.deepDefinition.correctiveAction ?? '',
      vulnerableFirst: persona?.deepDefinition.vulnerableFirst ?? '',
      vulnerableThen: persona?.deepDefinition.vulnerableThen ?? '',
      hardBoundary: persona?.deepDefinition.hardBoundary ?? '',
      hardBoundaryAction: persona?.deepDefinition.hardBoundaryAction ?? ''
    },
    vibeSelection: {
      useId,
      humanBaseId,
      layerIds: []
    }
  };
}

export function resolvePersonaBuilderName(draft: PersonaBuilderDraft): string {
  return draft.name.trim() || personaBaseLabel(draft.baseId);
}

export function resolvePersonaBuilderDescription(draft: PersonaBuilderDraft): string {
  return draft.description.trim() || getPersonaBaseOption(draft.baseId).short;
}

export function resolvePersonaBuilderStoredDescription(draft: PersonaBuilderDraft): string {
  return draft.description.trim();
}

export function buildPersonaPatchFromDraft(draft: PersonaBuilderDraft): PersonaUpdatePatch {
  const { vibeSelection, ...personaDraft } = draft;
  return {
    ...personaDraft,
    name: resolvePersonaBuilderName(draft),
    description: resolvePersonaBuilderStoredDescription(draft),
    purpose: draft.purpose.trim(),
    tags: draft.tags,
    deepDefinition: {
      ...draft.deepDefinition
    }
  };
}
