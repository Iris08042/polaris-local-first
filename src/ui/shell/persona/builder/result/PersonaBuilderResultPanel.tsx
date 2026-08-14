import {
  expressionLabel,
  personaBaseLabel,
  relationshipLabel
} from '../../../../../config/persona/personaBuilder';
import type { Persona } from '../../../../../types/domain';
import { runImpactAction, runSuccessAction } from '../../../../haptics';
import {
  buildPersonaPatchFromDraft,
  resolvePersonaBuilderDescription,
  resolvePersonaBuilderName,
  type PersonaBuilderDraft,
  type PersonaBuilderHandoff,
  type PersonaBuilderIntroCardSeed
} from '../../../../../app/persona/builder/builderShared';
import type { PersonaUpdatePatch } from '../../personaUiShared';

type PersonaBuilderResultPanelProps = {
  activePersona: Persona | null;
  draft: PersonaBuilderDraft;
  handoff: PersonaBuilderHandoff;
  canApplyToCurrent: boolean;
  onApplyToCurrent: (patch: PersonaUpdatePatch) => void;
  onCreateCollaborator: (patch: PersonaUpdatePatch, introCard: PersonaBuilderIntroCardSeed) => void;
};

function buildVisiblePromptPreview(prompt: string) {
  return prompt
    .split('\n\n')
    .filter((section) => !section.trim().startsWith('[边界]'))
    .join('\n\n')
    .trim();
}

function countPromptLines(prompt: string) {
  return prompt.split(/\n+/).map((line) => line.trim()).filter(Boolean).length;
}

function PersonaResultTextPreview({
  draft,
  handoff,
  finalPrompt
}: {
  draft: PersonaBuilderDraft;
  handoff: PersonaBuilderHandoff;
  finalPrompt: string;
}) {
  const resolvedName = resolvePersonaBuilderName(draft);
  const resolvedDescription = resolvePersonaBuilderDescription(draft);
  const promptBody = buildVisiblePromptPreview(finalPrompt);
  const promptLineCount = countPromptLines(promptBody);

  return (
    <section className="pb-result-namecard">
      <div className="pb-result-namecard-top">
        <span>预览</span>
        <span>{personaBaseLabel(draft.baseId)}</span>
      </div>

      <div className="pb-result-identity">
        <strong>{resolvedName}</strong>
        <p>{resolvedDescription}</p>
      </div>

      <div className="pb-result-namecard-meta">
        <span>{relationshipLabel(draft.relationship)}</span>
        <span>{expressionLabel(draft.expression)}</span>
      </div>

      <div className="pb-result-divider" />

      <div className="pb-result-text-block">
        <div className="pb-result-head">
          <strong>人格摘要</strong>
        </div>
        <div className="pb-result-summary">{handoff.summary || '先从左侧定一个底色，它的轮廓就会开始长出来。'}</div>
      </div>

      <div className="pb-result-text-block">
        <div className="pb-result-head">
          <strong>提示词</strong>
          <span>本地草稿 · {promptLineCount} 行</span>
        </div>
        <pre className="pb-result-prompt">{promptBody || '提示词会在这里根据当前人设结构生成。'}</pre>
      </div>
    </section>
  );
}

export function PersonaBuilderResultPanel({
  draft,
  handoff,
  canApplyToCurrent,
  onApplyToCurrent,
  onCreateCollaborator
}: PersonaBuilderResultPanelProps) {
  const finalCompiledPrompt = handoff.compiledPrompt;

  const applyBuilderToCurrent = () => {
    onApplyToCurrent({
      ...buildPersonaPatchFromDraft(draft),
      compiledPrompt: finalCompiledPrompt,
      builderManaged: true,
      generatedPromptMode: 'vnext'
    });
  };

  const createFromBuilder = () => {
    onCreateCollaborator({
      ...buildPersonaPatchFromDraft(draft),
      compiledPrompt: finalCompiledPrompt,
      builderManaged: true,
      generatedPromptMode: 'vnext'
    }, handoff.introCard);
  };

  return (
    <aside className="pb-result-card">
      <PersonaResultTextPreview
        draft={draft}
        handoff={handoff}
        finalPrompt={finalCompiledPrompt}
      />

      <div className="pb-actions">
        {canApplyToCurrent && (
          <button type="button" className="btn-secondary compact-btn" onClick={() => {
            void runSuccessAction(applyBuilderToCurrent);
          }}>
            保存到当前人格
          </button>
        )}
        <button type="button" className="btn-primary compact-btn" onClick={(event) => {
          runImpactAction(createFromBuilder, { element: event.currentTarget });
        }}>
          {canApplyToCurrent ? '另存为新人格' : '创建人格卡'}
        </button>
      </div>
    </aside>
  );
}
