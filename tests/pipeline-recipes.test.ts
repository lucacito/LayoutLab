import { describe, it, expect } from 'vitest';
import { MATRIX, targetKey, planTargets, buildGenerationPrompt, buildRepairPrompt } from '@/pipeline/recipes';
import { AXIS_VALUES } from '@/lib/catalog/filters';

describe('coverage matrix + plan', () => {
  it('every MATRIX target uses known axis values', () => {
    expect(MATRIX.length).toBeGreaterThan(0);
    for (const t of MATRIX) {
      expect(AXIS_VALUES.type).toContain(t.type);
      expect(AXIS_VALUES.niche).toContain(t.niche);
      expect(AXIS_VALUES.style).toContain(t.style);
    }
  });
  it('planTargets skips covered combos and honors count', () => {
    const covered = new Set([targetKey(MATRIX[0])]);
    const planned = planTargets(MATRIX, covered);
    expect(planned.map(targetKey)).not.toContain(targetKey(MATRIX[0]));
    expect(planTargets(MATRIX, new Set(), 2)).toHaveLength(2);
  });
});

describe('prompt builders', () => {
  const guide = { style: 'STYLE GUIDE TEXT', schema: 'SCHEMA TEXT', examples: ['{"ex":1}'] };
  it('generation prompt embeds the grounding and the target', () => {
    const { system, prompt } = buildGenerationPrompt({ type: 'hero', niche: 'saas', style: 'minimal' }, guide);
    expect(system + prompt).toContain('STYLE GUIDE TEXT');
    expect(system + prompt).toContain('SCHEMA TEXT');
    expect(prompt).toContain('hero');
    expect(prompt).toContain('saas');
  });
  it('repair prompt includes the prior JSON and the violation codes', () => {
    const { prompt } = buildRepairPrompt('{"bad":1}', [{ code: 'E_X', message: 'bad thing', path: 'a.b' }]);
    expect(prompt).toContain('E_X');
    expect(prompt).toContain('bad thing');
    expect(prompt).toContain('{"bad":1}');
  });
});
