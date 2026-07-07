import { describe, it, expect, vi } from 'vitest';
import { flowForBusinessType, normalizeBusinessType, FLOWS } from '@/pipeline/compose/flow';
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

describe('flow variants per business type (T3.2)', () => {
  it('the 5 main business types each have at least 2 flow variants, hero-first and final_cta-last', () => {
    for (const bt of ['saas', 'service/agency', 'local business', 'product/e-commerce', 'course/coaching']) {
      const variants = FLOWS[bt];
      expect(variants.length).toBeGreaterThanOrEqual(2);
      const ids = variants.map((v) => v.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const v of variants) {
        expect(v.steps[0].role).toBe('hero');
        expect(v.steps.at(-1)!.role).toBe('final_cta');
        expect(v.steps.length).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it('selects a flow variant deterministically by (businessType, key)', () => {
    const a = flowForBusinessType('saas', { key: 'Acme' });
    const b = flowForBusinessType('saas', { key: 'Acme' });
    expect(a).toEqual(b);
  });

  it('different keys can select different flow variants for the same business type (real variety, not always variant[0])', () => {
    const signatures = new Set(
      Array.from({ length: 40 }, (_, i) => flowForBusinessType('saas', { key: `business-${i}` }).map((s) => s.role).join(',')),
    );
    expect(signatures.size).toBeGreaterThan(1);
  });

  it('every step in every flow variant uses a known section type', () => {
    for (const variants of Object.values(FLOWS)) {
      for (const v of variants) {
        for (const s of v.steps) expect(RECIPE_BY_TYPE_KEYS).toContain(s.sectionType);
      }
    }
  });
});

describe('business-type normalization signal fallthrough (T3.2)', () => {
  it('maps clearly-signaled unknown-shaped types to a sensible existing bucket instead of always service/agency', () => {
    expect(normalizeBusinessType('appointment scheduling')).toBe('local business'); // booking-ish
    expect(normalizeBusinessType('wedding festival')).toBe('product/e-commerce'); // event-ish (ticketed)
    expect(normalizeBusinessType('freelance photographer showcase')).toBe('service/agency'); // portfolio-ish
    expect(normalizeBusinessType('animal charity')).toBe('service/agency'); // non-profit-ish
  });

  it('logs truly unmatched business types via the onUnmatched callback and still returns a sensible default', () => {
    const onUnmatched = vi.fn();
    const category = normalizeBusinessType('quantum widget concept', onUnmatched);
    expect(onUnmatched).toHaveBeenCalledWith('quantum widget concept');
    expect(category).toBe('service/agency');
  });

  it('does not log for a recognized business type', () => {
    const onUnmatched = vi.fn();
    normalizeBusinessType('SaaS', onUnmatched);
    expect(onUnmatched).not.toHaveBeenCalled();
  });

  it('flowForBusinessType forwards onUnmatched so callers (compose/index.ts) can log it', () => {
    const onUnmatched = vi.fn();
    flowForBusinessType('quantum widget concept', { onUnmatched });
    expect(onUnmatched).toHaveBeenCalledWith('quantum widget concept');
  });
});
