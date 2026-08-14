import { describe, expect, it } from 'vitest';
import { buildPersonaBuilderHandoff } from './builderHandoff';
import { buildPersonaPatchFromDraft, createPersonaBuilderDraft } from './builderShared';

function coverVariant(css: string | undefined) {
  return css?.match(/--persona-cover-variant: ([^;]+);/)?.[1] ?? '';
}

describe('buildPersonaBuilderHandoff', () => {
  it('builds a first room card from the same persona handoff', () => {
    const draft = {
      ...createPersonaBuilderDraft(null),
      name: 'null',
      description: '我拒绝存在，但你还是在跟我说话',
      baseId: 'null' as const
    };

    const handoff = buildPersonaBuilderHandoff(draft);

    expect(handoff.introCard.title).toBe('null · 人设卡');
    expect(handoff.introCard.language).toBe('html');
    expect(handoff.introCard.tags).toContain('首张房间');
    expect(handoff.introCard.code).toContain('<div class="name">null</div>');
    expect(handoff.introCard.code).toContain('我拒绝存在，但你还是在跟我说话');
    expect(handoff.introCard.code).toContain('提示词');
    expect(handoff.introCard.code).toContain('<span class="card-kind">PERSONA</span>');
    expect(handoff.introCard.cardFaceCss).toContain('#050506');
    expect(coverVariant(handoff.introCard.cardFaceCss)).toBe('null-fixed');
  });

  it('uses the selected base as the display default without storing it as an impression', () => {
    const draft = {
      ...createPersonaBuilderDraft(null),
      name: '',
      description: '',
      baseId: 'null' as const
    };

    const patch = buildPersonaPatchFromDraft(draft);
    const handoff = buildPersonaBuilderHandoff(draft);

    expect(patch.name).toBe('null');
    expect(patch.description).toBe('');
    expect('vibeSelection' in patch).toBe(false);
    expect(handoff.introCard.title).toBe('null · 人设卡');
    expect(handoff.introCard.cardNote).toBe('我拒绝存在，但你还是在跟我说话');
    expect(handoff.introCard.code).toContain('<div class="name">null</div>');
  });

  it('stores an explicit collaborator impression when the user writes one', () => {
    const draft = {
      ...createPersonaBuilderDraft(null),
      name: '主语',
      description: '会先把事情说清楚，再陪着推进。',
      baseId: 'subject' as const
    };

    expect(buildPersonaPatchFromDraft(draft).description).toBe('会先把事情说清楚，再陪着推进。');
  });

  it('compiles the builder draft into a Chinese layer package', () => {
    const draft = {
      ...createPersonaBuilderDraft(null),
      name: 'Aster',
      description: '把混乱扶成可以继续的路径',
      purpose: '替用户守住长期清晰',
      deepDefinition: {
        ...createPersonaBuilderDraft(null).deepDefinition,
        conflictPriority: '长期清晰',
        hardBoundary: '账号、隐私和不可逆动作'
      }
    };

    const handoff = buildPersonaBuilderHandoff(draft);

    expect(handoff.compiledPrompt).toContain('# 人格提示词结构');
    expect(handoff.compiledPrompt).toContain('## L1 身份');
    expect(handoff.compiledPrompt).toContain('你是「Aster」');
    expect(handoff.compiledPrompt).toContain('## L8 安全刹车');
    expect(handoff.compiledPrompt).toContain('账号、隐私和不可逆动作');
  });

  it('keeps the null intro cover fixed instead of randomizing it from draft content', () => {
    const baseDraft = {
      ...createPersonaBuilderDraft(null),
      name: 'null',
      description: '我拒绝存在，但你还是在跟我说话',
      baseId: 'null' as const
    };
    const changedDraft = {
      ...baseDraft,
      name: '另一个空无',
      description: '换了文字也不改变空无的卡面',
      purpose: '测试固定封面',
      expression: 'intimate' as const
    };

    const first = buildPersonaBuilderHandoff(baseDraft).introCard.cardFaceCss;
    const second = buildPersonaBuilderHandoff(changedDraft).introCard.cardFaceCss;

    expect(first).toBe(second);
    expect(coverVariant(first)).toBe('null-fixed');
  });

  it('chooses a stable blank intro cover from several blank variants', () => {
    const draft = {
      ...createPersonaBuilderDraft(null),
      name: '未命名的白纸',
      description: '只先留下一个安静轮廓',
      baseId: 'blank' as const
    };
    const first = buildPersonaBuilderHandoff(draft).introCard.cardFaceCss;
    const second = buildPersonaBuilderHandoff(draft).introCard.cardFaceCss;
    const variants = new Set(
      ['白纸', '边缘', '留白', '冷纸', '第一行', '空房间'].map((name) => coverVariant(
        buildPersonaBuilderHandoff({ ...draft, name }).introCard.cardFaceCss
      ))
    );

    expect(first).toBe(second);
    expect(coverVariant(first)).toMatch(/^blank-(quiet-sheet|soft-index|first-line)$/);
    expect(variants.size).toBeGreaterThan(1);
  });

  it('chooses a stable subject intro cover from several subject variants', () => {
    const draft = {
      ...createPersonaBuilderDraft(null),
      name: 'Archivist',
      description: '负责把关系和任务都收束清楚',
      baseId: 'subject' as const
    };
    const first = buildPersonaBuilderHandoff(draft).introCard.cardFaceCss;
    const second = buildPersonaBuilderHandoff(draft).introCard.cardFaceCss;
    const variants = new Set(
      ['Archivist', 'Harbor', 'Signal', 'Contour', 'Index', 'Anchor'].map((name) => coverVariant(
        buildPersonaBuilderHandoff({ ...draft, name }).introCard.cardFaceCss
      ))
    );

    expect(first).toBe(second);
    expect(coverVariant(first)).toMatch(/^subject-(identity-plate|calm-archive|ink-marker)$/);
    expect(variants.size).toBeGreaterThan(1);
  });
});
