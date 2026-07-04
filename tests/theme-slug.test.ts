import { describe, it, expect } from 'vitest';
import { themePageSlug, themePageTitle, type ThemeSpec, type ThemePage } from '@/pipeline/theme';
import type { Brief } from '@/pipeline/compose';

const brief: Brief = {
  businessType: 'local business',
  businessName: 'Bella Nota',
  tagline: 'Wood-fired Italian, made by hand',
  audience: 'locals who want a warm night out',
  conversionGoal: 'book a table',
  primaryCta: 'Reserve a Table',
  accentColorHex: '#B4472E',
  voice: 'warm, confident, unfussy',
};
const spec = { niche: 'restaurant', style: 'elegant', brief } as ThemeSpec;
const home: ThemePage = { role: 'home', roleLabel: 'Home', flow: [] };
const menu: ThemePage = { role: 'menu', roleLabel: 'Menu', flow: [] };

describe('theme page identity', () => {
  it('slug is deterministic, brand+role scoped, and url-safe', () => {
    expect(themePageSlug(brief, spec, home)).toBe('bella-nota-elegant-restaurant-home-page-for-divi-5');
    expect(themePageSlug(brief, spec, menu)).toBe('bella-nota-elegant-restaurant-menu-page-for-divi-5');
  });
  it('distinct pages get distinct slugs', () => {
    expect(themePageSlug(brief, spec, home)).not.toBe(themePageSlug(brief, spec, menu));
  });
  it('title carries the brand and the human role label', () => {
    expect(themePageTitle(brief, spec, home)).toBe('Bella Nota — Elegant Restaurant Home Page for Divi 5');
  });
});
