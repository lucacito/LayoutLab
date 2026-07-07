import { describe, it, expect } from 'vitest';
import { selectPalette, selectPaletteVariantId, pickByRendezvous, contrastRatio } from '@/pipeline/compose/palettes';
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

  it('every curated palette keeps tint legible on its own dark panel (WCAG AA, 4.5:1+) — the on-dark text substitute', () => {
    for (const style of AXIS_VALUES.style) {
      for (const niche of AXIS_VALUES.niche) {
        const p = selectPalette({ style, niche }, '#E4572E');
        expect(contrastRatio(p.tint, p.dark)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('pickByRendezvous — append-stability', () => {
  it('is a pure, deterministic function of (key, items)', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(pickByRendezvous('some-key', items)).toEqual(pickByRendezvous('some-key', items));
  });

  it('appending a new item never remaps a key from one EXISTING item to another EXISTING item', () => {
    const before = [{ id: 'alpha' }, { id: 'beta' }, { id: 'gamma' }];
    const after = [...before, { id: 'delta' }];
    const keys = Array.from({ length: 500 }, (_, i) => `synthetic-key-${i}`);
    let remappedAmongExisting = 0;
    for (const key of keys) {
      const winnerBefore = pickByRendezvous(key, before).id;
      const winnerAfter = pickByRendezvous(key, after).id;
      if (winnerBefore !== winnerAfter && winnerAfter !== 'delta') {
        remappedAmongExisting++;
      }
    }
    expect(remappedAmongExisting).toBe(0);
    // Sanity: the new item actually wins SOME keys, proving the test isn't vacuous.
    const wonByNewItem = keys.filter((key) => pickByRendezvous(key, after).id === 'delta');
    expect(wonByNewItem.length).toBeGreaterThan(0);
  });
});

describe('contrastRatio — malformed input guard', () => {
  it('throws on a malformed hex string instead of silently computing garbage', () => {
    expect(() => contrastRatio('not-a-color', '#FFFFFF')).toThrow();
    expect(() => contrastRatio('#FFFFFF', '#12')).toThrow();
    expect(() => contrastRatio('', '#FFFFFF')).toThrow();
  });

  it('still accepts well-formed hex with or without the leading #', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('000000', 'FFFFFF')).toBeCloseTo(21, 0);
  });
});

describe('selectPalette — pinned regression (breaks loudly if the selection scheme reshuffles)', () => {
  it('pins concrete (style, niche) -> palette-id selections', () => {
    expect(selectPaletteVariantId({ style: 'minimal', niche: 'saas' })).toBe('minimal-cool-slate');
    expect(selectPaletteVariantId({ style: 'dark', niche: 'saas' })).toBe('dark-warm-charcoal');
    expect(selectPaletteVariantId({ style: 'bold', niche: 'agency' })).toBe('bold-vivid-warm');
    expect(selectPaletteVariantId({ style: 'corporate', niche: 'restaurant' })).toBe('corporate-muted-slate');
    expect(selectPaletteVariantId({ style: 'elegant', niche: 'fitness' })).toBe('elegant-warm-ivory-burgundy');
  });
});
