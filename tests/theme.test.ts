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
  it('defines brand radii and the soft shadow', () => {
    const r = (config.theme?.extend?.borderRadius ?? {}) as Record<string, string>;
    expect(r.button).toBe('4px');
    expect(r.card).toBe('16px');
    const s = (config.theme?.extend?.boxShadow ?? {}) as Record<string, string>;
    expect(s.soft).toContain('rgba(71,103,136');
  });
});
