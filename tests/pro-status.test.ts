import { describe, it, expect } from 'vitest';
import { AI_EDITOR_PRO_AVAILABLE, isProductPaused } from '@/lib/site/pro-status';

describe('AI Editor Pro pause switch', () => {
  it('ships paused: the Pro add-on is not built yet', () => {
    expect(AI_EDITOR_PRO_AVAILABLE).toBe(false);
  });

  it('pauses ai-editor-divi5-pro while the switch is off', () => {
    expect(isProductPaused('ai-editor-divi5-pro')).toBe(true);
    expect(isProductPaused('ai-editor-divi5-pro', false)).toBe(true);
  });

  it('un-pauses ai-editor-divi5-pro when the switch is flipped on', () => {
    expect(isProductPaused('ai-editor-divi5-pro', true)).toBe(false);
  });

  it('never pauses any other product', () => {
    for (const p of ['elementor-to-divi5-pro', 'divi-to-elementor-pro', 'beaver-to-divi5-pro', 'wpbakery-to-divi5-pro']) {
      expect(isProductPaused(p, false)).toBe(false);
      expect(isProductPaused(p)).toBe(false);
    }
  });
});
