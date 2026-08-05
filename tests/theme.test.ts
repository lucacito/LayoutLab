import { describe, it, expect } from 'vitest';
import config from '@/tailwind.config';

describe('brand theme tokens', () => {
  const colors = (config.theme?.extend?.colors ?? {}) as Record<string, string>;
  it('defines the core brand colors with exact hex values', () => {
    expect(colors.navy).toBe('#0B3558');
    expect(colors.action).toBe('#635BFF');
    expect(colors.mist).toBe('#F8F9FB');
    expect(colors.fog).toBe('#E7EDF6');
    expect(colors.muted).toBe('#476788');
    expect(colors.border).toBe('#D4E0ED');
  });
  it('does NOT clobber Tailwind built-in palette names', () => {
    expect(colors.blue).toBeUndefined();
    expect(colors.slate).toBeUndefined();
    expect(colors.gray).toBeUndefined();
  });
  it('defines the gradient stops used to build the immersive canvas', () => {
    // The `.canvas-*` grounds are blends of these — no new brand hues.
    expect(colors['g-purple']).toBe('#8247F5');
    expect(colors['g-pink']).toBe('#E55CFF');
    expect(colors['g-cyan']).toBe('#0099FF');
    expect(colors['g-amber']).toBe('#FFA600');
  });
  it('defines brand radii, including the full pill', () => {
    const r = (config.theme?.extend?.borderRadius ?? {}) as Record<string, string>;
    expect(r.button).toBe('10px');
    expect(r.card).toBe('20px');
    expect(r.panel).toBe('28px');
    expect(r.pill).toBe('999px');
  });
  it('tints every elevation shadow with a brand colour, never neutral grey', () => {
    const s = (config.theme?.extend?.boxShadow ?? {}) as Record<string, string>;
    // navy 11,53,88 · action 99,91,255 — depth reads as coloured light.
    expect(s.soft).toContain('rgba(11,53,88');
    expect(s.float).toContain('rgba(11,53,88');
    expect(s.lift).toContain('rgba(99,91,255');
    expect(s.glow).toContain('rgba(99,91,255');
    expect(s['glow-lg']).toContain('rgba(99,91,255');
  });
  it('loads a display face separate from the body face', () => {
    const f = (config.theme?.extend?.fontFamily ?? {}) as Record<string, string[]>;
    expect(f.display?.[0]).toBe('var(--font-display)');
    expect(f.sans?.[0]).toBe('var(--font-sans)');
  });
});
