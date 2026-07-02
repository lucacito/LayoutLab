import { describe, it, expect } from 'vitest';
import { flowForBusinessType } from '@/pipeline/compose/flow';
import { RECIPE_BY_TYPE_KEYS } from '@/pipeline/compose/flow';

describe('flowForBusinessType', () => {
  it('course/coaching returns the transformation spine ending in a final CTA', () => {
    const steps = flowForBusinessType('course/coaching');
    expect(steps[0].role).toBe('hero');
    expect(steps.at(-1)!.role).toBe('final_cta');
    expect(steps.some((s) => s.role === 'social_proof')).toBe(true);
  });
  it('every step uses a known section type and marks the hero + final CTA as cta sections', () => {
    for (const bt of ['SaaS', 'service/agency', 'local business', 'product/e-commerce', 'course/coaching']) {
      const steps = flowForBusinessType(bt);
      expect(steps.length).toBeGreaterThanOrEqual(6);
      for (const s of steps) expect(RECIPE_BY_TYPE_KEYS).toContain(s.sectionType);
      expect(steps.find((s) => s.role === 'hero')!.cta).toBe(true);
      expect(steps.find((s) => s.role === 'final_cta')!.cta).toBe(true);
    }
  });
  it('falls back to a default spine for an unknown business type', () => {
    const steps = flowForBusinessType('something-weird');
    expect(steps[0].role).toBe('hero');
    expect(steps.at(-1)!.role).toBe('final_cta');
  });
});
