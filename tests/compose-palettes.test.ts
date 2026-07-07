import { describe, it, expect } from 'vitest';
import { selectPalette, contrastRatio } from '@/pipeline/compose/palettes';
import { AXIS_VALUES } from '@/lib/catalog/filters';

describe('selectPalette', () => {
  it('is a pure, deterministic function of (style, niche) — same target, same palette', () => {
    const a = selectPalette({ style: 'minimal', niche: 'saas' }, '#E4572E');
    const b = selectPalette({ style: 'minimal', niche: 'saas' }, '#E4572E');
    expect(a).toEqual(b);
  });

  it('always uses the brief accentColorHex as primary, regardless of style/niche', () => {
    for (const style of AXIS_VALUES.style) {
      const p = selectPalette({ style, niche: 'agency' }, '#123456');
      expect(p.primary).toBe('#123456');
    }
  });

  it('produces a palette for every style axis value without falling back silently', () => {
    for (const style of AXIS_VALUES.style) {
      const p = selectPalette({ style, niche: 'saas' }, '#E4572E');
      expect(p.tint).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.dark).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.heading).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.body).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.secondary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('two different styles produce visibly different tint, dark, and text colors (not just accent)', () => {
    const minimal = selectPalette({ style: 'minimal', niche: 'saas' }, '#E4572E');
    const dark = selectPalette({ style: 'dark', niche: 'saas' }, '#E4572E');
    const bold = selectPalette({ style: 'bold', niche: 'saas' }, '#E4572E');
    const elegant = selectPalette({ style: 'elegant', niche: 'saas' }, '#E4572E');
    expect(minimal.tint).not.toBe(dark.tint);
    expect(minimal.dark).not.toBe(dark.dark);
    expect(minimal.heading).not.toBe(dark.heading);
    expect(minimal.tint).not.toBe(bold.tint);
    expect(minimal.tint).not.toBe(elegant.tint);
    expect(bold.tint).not.toBe(elegant.tint);
  });

  it('gives niche-level variety within a single style (not one fixed variant per style)', () => {
    const tints = new Set(
      AXIS_VALUES.niche.map((niche) => selectPalette({ style: 'corporate', niche }, '#E4572E').tint),
    );
    expect(tints.size).toBeGreaterThan(1);
  });

  it('falls back gracefully to a coherent default for an unknown/missing style', () => {
    const unknown = selectPalette({ style: 'not-a-real-style', niche: 'saas' }, '#E4572E');
    const missing = selectPalette({ niche: 'saas' }, '#E4572E');
    expect(unknown.tint).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(missing.tint).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('every curated palette keeps heading/body legible on both white and its own tint (WCAG AA, 4.5:1+)', () => {
    for (const style of AXIS_VALUES.style) {
      for (const niche of AXIS_VALUES.niche) {
        const p = selectPalette({ style, niche }, '#E4572E');
        expect(contrastRatio(p.heading, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(p.heading, p.tint)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(p.body, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(p.body, p.tint)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
