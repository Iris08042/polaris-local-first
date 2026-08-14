import {
  basePromptGuidance,
  createPersonaTemplate,
  isNullPersonaBase,
  personaBaseLabel,
  relationshipLabel
} from '../../../config/persona/personaBuilder';
import type { Persona } from '../../../types/domain';
import type { PersonaBuilderDraft, PersonaBuilderHandoff, PersonaBuilderIntroCardSeed } from './builderShared';
import {
  buildPersonaPatchFromDraft,
  resolvePersonaBuilderDescription,
  resolvePersonaBuilderName
} from './builderShared';
import { buildPersonaVibePrompt, buildPersonaVibeSummary } from './vibeBuilderModel';

function compact(text: string) {
  return text.trim().replace(/\s+/g, ' ');
}

function buildVisiblePromptPreview(prompt: string) {
  return prompt
    .split('\n\n')
    .filter((section) => !section.trim().startsWith('[边界]'))
    .join('\n\n')
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function splitPromptLines(prompt: string) {
  return prompt
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function selectedTagSeed(draft: PersonaBuilderDraft) {
  return Object.values(draft.tags)
    .reduce<string[]>((items, group) => [...items, ...group], [])
    .sort()
    .join(',');
}

function stableHash(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableCoverIndex(draft: PersonaBuilderDraft, count: number) {
  if (count <= 1) return 0;
  const seed = [
    draft.baseId,
    compact(draft.name),
    compact(draft.description),
    compact(draft.purpose),
    draft.relationship,
    draft.expression,
    draft.initiative,
    draft.memoryStyle,
    draft.silence,
    draft.disagreement,
    draft.humor,
    draft.attachment,
    draft.curiosity,
    draft.selfDisclosure,
    selectedTagSeed(draft),
    ...Object.values(draft.deepDefinition).map(compact)
  ].join('|');

  return stableHash(seed) % count;
}

const INTRO_CARD_FACE_BASE_CSS = `
& .code-card-main {
  box-sizing: border-box;
  min-height: 100%;
  padding: 11px;
  position: relative;
  overflow: hidden;
}
& .card-meta-row,
& h3,
& .code-card-origin,
& .tags {
  position: relative;
  z-index: 1;
}
& h3 {
  overflow-wrap: anywhere;
}
& .code-card-snippet {
  display: none;
}
`;

const NULL_INTRO_CARD_FACE_CSS = `
& {
  --persona-cover-variant: null-fixed;
  background: linear-gradient(145deg, #050506, #101014 48%, #030304);
  border-color: rgba(255,255,255,0.12);
  color: rgba(235,235,240,0.72);
  box-shadow: 0 26px 54px rgba(0,0,0,0.34);
}
&::before {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
  opacity: 0.22;
}
& .card-meta-row small,
& .code-card-origin,
& .code-card-snippet {
  color: rgba(225,225,232,0.46);
}
& h3 {
  color: rgba(245,245,248,0.82);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 21px;
  font-weight: 400;
  letter-spacing: 0.18em;
}
& .tags span {
  background: rgba(255,255,255,0.06);
  color: rgba(235,235,240,0.46);
  border: 1px solid rgba(255,255,255,0.08);
}
`;

const BLANK_INTRO_CARD_FACE_VARIANTS = [
  `
& {
  --persona-cover-variant: blank-quiet-sheet;
  background: linear-gradient(145deg, #fcfcfa, #eef0ef 52%, #dfe3e0);
  border-color: rgba(82,88,83,0.14);
  color: #2f3430;
  box-shadow: 0 24px 52px rgba(58,66,61,0.13);
}
& .code-card-main::before {
  content: '';
  position: absolute;
  inset: 11px 11px auto 11px;
  height: 1px;
  background: linear-gradient(90deg, rgba(51,57,52,0.16), transparent 72%);
}
& .code-card-main::after {
  content: '';
  position: absolute;
  right: 13px;
  bottom: 13px;
  width: 38px;
  height: 38px;
  border-right: 1px solid rgba(51,57,52,0.14);
  border-bottom: 1px solid rgba(51,57,52,0.1);
}
& .card-meta-row small {
  color: rgba(60,68,62,0.5);
}
& h3 {
  color: #242924;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 20px;
  font-weight: 500;
}
& .code-card-origin {
  color: rgba(48,55,50,0.68);
}
& .tags span {
  background: rgba(255,255,255,0.48);
  color: rgba(48,55,50,0.72);
  border: 1px solid rgba(82,88,83,0.13);
}
`,
  `
& {
  --persona-cover-variant: blank-soft-index;
  background: linear-gradient(135deg, #f8f9f8, #e9edf0 47%, #d8dee3);
  border-color: rgba(68,76,82,0.15);
  color: #293036;
  box-shadow: 0 24px 52px rgba(48,58,65,0.14);
}
& .code-card-main::before {
  content: '';
  position: absolute;
  inset: 9px auto 9px 11px;
  width: 3px;
  background: linear-gradient(180deg, rgba(42,50,56,0.42), rgba(42,50,56,0.08));
}
& .code-card-main::after {
  content: '';
  position: absolute;
  inset: auto 12px 14px 28px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(42,50,56,0.18), transparent);
}
& .card-meta-row small {
  color: rgba(50,59,66,0.52);
}
& h3 {
  color: #20272d;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 19px;
  font-weight: 500;
}
& .code-card-origin {
  color: rgba(43,52,59,0.66);
}
& .tags span {
  background: rgba(255,255,255,0.5);
  color: rgba(43,52,59,0.72);
  border: 1px solid rgba(68,76,82,0.13);
}
`,
  `
& {
  --persona-cover-variant: blank-first-line;
  background: linear-gradient(145deg, #fdfcf8, #f0efe7 48%, #e2e3d8);
  border-color: rgba(91,94,78,0.15);
  color: #303228;
  box-shadow: 0 24px 52px rgba(72,74,59,0.13);
}
& .code-card-main::before {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  top: 44px;
  height: 24px;
  border-top: 1px solid rgba(78,80,64,0.13);
  border-bottom: 1px solid rgba(78,80,64,0.08);
}
& .code-card-main::after {
  content: '';
  position: absolute;
  left: 13px;
  bottom: 12px;
  width: 28px;
  height: 1px;
  background: rgba(78,80,64,0.22);
}
& .card-meta-row small {
  color: rgba(61,63,51,0.52);
}
& h3 {
  color: #27291f;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 20px;
  font-weight: 500;
}
& .code-card-origin {
  color: rgba(50,53,42,0.66);
}
& .tags span {
  background: rgba(255,255,255,0.5);
  color: rgba(50,53,42,0.72);
  border: 1px solid rgba(91,94,78,0.13);
}
`
] as const;

const SUBJECT_INTRO_CARD_FACE_VARIANTS = [
  `
& {
  --persona-cover-variant: subject-identity-plate;
  background: linear-gradient(145deg, #f7f7f5, #e7ebee 48%, #d8ddd9);
  border-color: rgba(55,63,66,0.14);
  color: #222728;
  box-shadow: 0 24px 52px rgba(45,52,55,0.14);
}
& .code-card-main::before {
  content: '';
  position: absolute;
  inset: 10px 10px auto 10px;
  height: 34px;
  border: 1px solid rgba(45,52,55,0.1);
  border-left-color: rgba(45,52,55,0.22);
}
& .card-meta-row small {
  color: rgba(45,52,55,0.54);
}
& h3 {
  color: #171b1c;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 20px;
  font-weight: 500;
}
& .code-card-origin {
  color: rgba(35,40,42,0.68);
}
& .tags span {
  background: rgba(255,255,255,0.46);
  color: rgba(35,40,42,0.72);
  border: 1px solid rgba(55,63,66,0.12);
}
`,
  `
& {
  --persona-cover-variant: subject-calm-archive;
  background: linear-gradient(135deg, #f4f7f6, #e5ece8 50%, #d7dfda);
  border-color: rgba(50,75,66,0.15);
  color: #1f2a27;
  box-shadow: 0 24px 52px rgba(38,64,55,0.14);
}
& .code-card-main::before {
  content: '';
  position: absolute;
  right: -22px;
  top: 18px;
  width: 88px;
  height: 88px;
  border: 1px solid rgba(45,76,65,0.14);
  transform: rotate(12deg);
}
& .code-card-main::after {
  content: '';
  position: absolute;
  left: 11px;
  right: 11px;
  bottom: 42px;
  height: 1px;
  background: linear-gradient(90deg, rgba(45,76,65,0.18), transparent);
}
& .card-meta-row small {
  color: rgba(35,61,52,0.52);
}
& h3 {
  color: #182521;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 19px;
  font-weight: 500;
}
& .code-card-origin {
  color: rgba(31,53,46,0.68);
}
& .tags span {
  background: rgba(255,255,255,0.48);
  color: rgba(31,53,46,0.72);
  border: 1px solid rgba(50,75,66,0.12);
}
`,
  `
& {
  --persona-cover-variant: subject-ink-marker;
  background: linear-gradient(145deg, #f7f8fa, #e9edf2 46%, #dce2e8);
  border-color: rgba(58,68,80,0.15);
  color: #202833;
  box-shadow: 0 24px 52px rgba(48,58,70,0.14);
}
& .code-card-main::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 11px;
  width: 42px;
  height: 42px;
  border-top: 1px solid rgba(43,53,66,0.18);
  border-left: 1px solid rgba(43,53,66,0.2);
}
& .code-card-main::after {
  content: '';
  position: absolute;
  right: 13px;
  bottom: 13px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid rgba(43,53,66,0.16);
}
& .card-meta-row small {
  color: rgba(43,53,66,0.52);
}
& h3 {
  color: #17202a;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 20px;
  font-weight: 500;
}
& .code-card-origin {
  color: rgba(36,45,56,0.68);
}
& .tags span {
  background: rgba(255,255,255,0.5);
  color: rgba(36,45,56,0.72);
  border: 1px solid rgba(58,68,80,0.12);
}
`
] as const;

function buildIntroCardCss(draft: PersonaBuilderDraft) {
  if (isNullPersonaBase(draft.baseId)) {
    return `${INTRO_CARD_FACE_BASE_CSS}${NULL_INTRO_CARD_FACE_CSS}`;
  }

  if (draft.baseId === 'blank') {
    return `${INTRO_CARD_FACE_BASE_CSS}${BLANK_INTRO_CARD_FACE_VARIANTS[
      stableCoverIndex(draft, BLANK_INTRO_CARD_FACE_VARIANTS.length)
    ]}`;
  }

  return `${INTRO_CARD_FACE_BASE_CSS}${SUBJECT_INTRO_CARD_FACE_VARIANTS[
    stableCoverIndex(draft, SUBJECT_INTRO_CARD_FACE_VARIANTS.length)
  ]}`;
}

function buildIntroCardCode(args: {
  draft: PersonaBuilderDraft;
  summary: string;
  prompt: string;
}) {
  const { draft, summary, prompt } = args;
  const name = resolvePersonaBuilderName(draft);
  const description = resolvePersonaBuilderDescription(draft);
  const motto = basePromptGuidance(draft.baseId);
  const badge = `${personaBaseLabel(draft.baseId)} / ${relationshipLabel(draft.relationship)}`;
  const promptLines = splitPromptLines(prompt);
  const promptLineMarkup = promptLines.length > 0
    ? promptLines.map((line) => `<p class="prompt-line">${escapeHtml(line)}</p>`).join('\n      ')
    : '<p class="prompt-line prompt-accent">提示词会在这里根据当前人设结构生成。</p>';

  return `<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(name)} · 人设卡</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #050506;
    font-family: "Noto Serif SC", "Songti SC", "STSong", Georgia, serif;
    color: rgba(255, 255, 255, 0.75);
    padding: 20px;
  }

  .card {
    width: 100%;
    max-width: 420px;
    position: relative;
    overflow: hidden;
  }

  .card-header {
    text-align: center;
    padding: 48px 32px 36px;
    position: relative;
  }

  .card-header::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
  }

  .avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1a1a1d, #0e0e10);
    border: 1px solid rgba(255, 255, 255, 0.06);
    margin: 0 auto 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .avatar::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.06);
  }

  .avatar::after {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: 50%;
    background: conic-gradient(from 180deg, transparent 70%, rgba(255, 255, 255, 0.04) 100%);
  }

  .name {
    font-size: 28px;
    font-weight: 200;
    letter-spacing: 10px;
    color: rgba(255, 255, 255, 0.45);
    text-indent: 10px;
    margin-bottom: 10px;
    overflow-wrap: anywhere;
  }

  .tagline {
    font-size: 11px;
    letter-spacing: 2.5px;
    color: rgba(255, 255, 255, 0.18);
    font-weight: 300;
    line-height: 1.8;
  }

  .motto-section {
    padding: 28px 36px;
    text-align: center;
    position: relative;
  }

  .motto-label {
    font-size: 10px;
    letter-spacing: 3px;
    color: rgba(255, 255, 255, 0.12);
    text-transform: uppercase;
    margin-bottom: 14px;
  }

  .motto {
    font-size: 13.5px;
    line-height: 2;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 300;
    letter-spacing: 1.5px;
  }

  .divider {
    width: 100%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06) 30%, rgba(255, 255, 255, 0.06) 70%, transparent);
  }

  .summary-section {
    padding: 28px 36px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 16px;
  }

  .section-title {
    font-size: 11px;
    letter-spacing: 3px;
    color: rgba(255, 255, 255, 0.2);
    font-weight: 400;
  }

  .section-badge {
    font-size: 10px;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.12);
    padding: 3px 10px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 20px;
    white-space: nowrap;
  }

  .summary-text {
    font-size: 13px;
    line-height: 2;
    color: rgba(255, 255, 255, 0.3);
    font-weight: 300;
    letter-spacing: 0.5px;
    white-space: pre-wrap;
  }

  .prompt-section {
    padding: 28px 36px 36px;
  }

  .prompt-block {
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    padding: 24px 22px;
    margin-top: 14px;
  }

  .prompt-line {
    font-size: 12.5px;
    line-height: 2.1;
    color: rgba(255, 255, 255, 0.32);
    font-weight: 300;
    letter-spacing: 0.3px;
  }

  .prompt-line + .prompt-line {
    margin-top: 6px;
  }

  .prompt-accent {
    color: rgba(255, 255, 255, 0.13);
    font-size: 11px;
    letter-spacing: 0.5px;
  }

  .card-footer {
    padding: 20px 36px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .footer-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
  }

  .footer-text {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.1);
    letter-spacing: 2px;
  }

  .card-kind {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.08);
    letter-spacing: 1px;
  }

  @keyframes breathe {
    0%, 100% { opacity: 0.12; }
    50% { opacity: 0.06; }
  }

  .card::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, 0.015) 0%, transparent 50%);
    animation: breathe 8s ease-in-out infinite;
    pointer-events: none;
  }
</style>
</head>
<body>
<div class="card">
  <div class="card-header">
    <div class="avatar"></div>
    <div class="name">${escapeHtml(name)}</div>
    <div class="tagline">${escapeHtml(description)}</div>
  </div>

  <div class="motto-section">
    <div class="motto-label">底色片段</div>
    <div class="motto">${escapeHtml(motto)}</div>
  </div>

  <div class="divider"></div>

  <div class="summary-section">
    <div class="section-header">
      <span class="section-title">人格摘要</span>
      <span class="section-badge">${escapeHtml(badge)}</span>
    </div>
    <div class="summary-text">${escapeHtml(summary || '先定住一个底色，之后再从相处里长出更多细节。')}</div>
  </div>

  <div class="divider"></div>

  <div class="prompt-section">
    <div class="section-header">
      <span class="section-title">提示词</span>
      <span class="section-badge">${promptLines.length} 行</span>
    </div>
    <div class="prompt-block">
      ${promptLineMarkup}
    </div>
  </div>

  <div class="divider"></div>

  <div class="card-footer">
    <div class="footer-left">
      <div class="status-dot"></div>
      <span class="footer-text">角色设定</span>
    </div>
    <span class="card-kind">PERSONA</span>
  </div>
</div>
</body>
</html>`;
}

function buildIntroCardFromHandoff(args: {
  draft: PersonaBuilderDraft;
  summary: string;
  compiledPrompt: string;
}): PersonaBuilderIntroCardSeed {
  const { draft, summary, compiledPrompt } = args;
  const name = resolvePersonaBuilderName(draft);
  const description = resolvePersonaBuilderDescription(draft);
  const shapeTag = personaBaseLabel(draft.baseId);

  return {
    title: `${name} · 人设卡`,
    cardNote: description,
    language: 'html',
    code: buildIntroCardCode({
      draft,
      summary,
      prompt: buildVisiblePromptPreview(compiledPrompt)
    }),
    cardFaceCss: buildIntroCardCss(draft),
    tags: ['人设', '首张房间', shapeTag, relationshipLabel(draft.relationship)],
    source: 'manual'
  };
}

export function buildPersonaFromDraft(draft: PersonaBuilderDraft): Persona {
  const patch = buildPersonaPatchFromDraft(draft);
  return createPersonaTemplate({
    id: 'builder-preview',
    name: patch.name ?? resolvePersonaBuilderName(draft),
    description: patch.description ?? resolvePersonaBuilderDescription(draft),
    purpose: patch.purpose,
    baseId: patch.baseId,
    relationship: patch.relationship,
    expression: patch.expression,
    tags: patch.tags,
    initiative: patch.initiative,
    memoryStyle: patch.memoryStyle,
    silence: patch.silence,
    disagreement: patch.disagreement,
    humor: patch.humor,
    attachment: patch.attachment,
    curiosity: patch.curiosity,
    selfDisclosure: patch.selfDisclosure,
    deepDefinition: { ...draft.deepDefinition }
  });
}

export function buildPersonaBuilderHandoff(draft: PersonaBuilderDraft): PersonaBuilderHandoff {
  const compiledPrompt = buildPersonaVibePrompt(draft);
  const runtimeNote = '当前主运行时使用人格提示词生成器生成的提示词。';

  if (isNullPersonaBase(draft.baseId)) {
    const summary = '这个人格不会主动建立关系，也不会把自己稳定下来。它更像语言偶尔绕到自己身上时留下的一道裂缝。';
    return {
      summary,
      compiledPrompt,
      effectivePrompt: compiledPrompt,
      effectiveSource: 'vnext',
      runtimeNote,
      introCard: buildIntroCardFromHandoff({
        draft,
        summary,
        compiledPrompt
      })
    };
  }

  const summary = buildPersonaVibeSummary(draft);

  return {
    summary,
    compiledPrompt,
    effectivePrompt: compiledPrompt,
    effectiveSource: 'vnext',
    runtimeNote,
    introCard: buildIntroCardFromHandoff({
      draft,
      summary,
      compiledPrompt
    })
  };
}
