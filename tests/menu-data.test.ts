import { describe, it, expect } from 'vitest';
import {
  TYPE_LABELS,
  PRIMARY_NAV,
  PLUGIN_MENU,
  LAYOUT_MENU_COLUMNS,
  LAYOUT_MENU_CTA,
} from '@/lib/nav/menu-data';

describe('menu-data', () => {
  it('labels the cards type', () => {
    expect(TYPE_LABELS.cards).toBe('Cards');
  });

  it('defines the mega-menu PRIMARY_NAV contract (Free layouts → /browse, no standalone Browse)', () => {
    expect(PRIMARY_NAV).toEqual([
      { key: 'plugins', label: 'Plugins', href: '/plugins', mega: 'plugins' },
      { key: 'layouts', label: 'Free layouts', href: '/browse', mega: 'layouts' },
      { key: 'guides', label: 'Guides', href: '/guides' },
    ]);
    expect(PRIMARY_NAV.find((m) => m.key === 'browse')).toBeUndefined();
  });

  it('lists AI Editor first, then all converters in the plugins mega-menu', () => {
    expect(PLUGIN_MENU.map((p) => p.href)).toEqual([
      '/plugins/divi-5-ai-editor',
      '/plugins/elementor-to-divi-5',
      '/plugins/beaver-builder-to-divi-5',
      '/plugins/wpbakery-to-divi-5',
      '/plugins/divi-to-elementor',
    ]);
    const aiEditor = PLUGIN_MENU.find((p) => p.href === '/plugins/divi-5-ai-editor');
    expect(aiEditor?.name).toBe('AI Editor for Divi 5');
    expect(aiEditor?.chip).toMatch(/from \$/);
    const wpbakery = PLUGIN_MENU.find((p) => p.href === '/plugins/wpbakery-to-divi-5');
    expect(wpbakery?.name).toBe('WPBakery → Divi 5');
    expect(wpbakery?.chip).toBe('Free on wordpress.org · Pro $25/yr');
    expect(JSON.stringify(PLUGIN_MENU)).not.toContain('$30');
  });

  it('builds taxonomy columns with valid /type, /niche, /style hrefs', () => {
    const titles = LAYOUT_MENU_COLUMNS.map((c) => c.title);
    expect(titles).toEqual(['By type', 'By industry', 'By style']);
    const all = LAYOUT_MENU_COLUMNS.flatMap((c) => c.links);
    expect(all.every((l) => /^\/(type|niche|style)\/[a-z_]+$/.test(l.href))).toBe(true);
    expect(all.find((l) => l.href === '/type/hero')?.label).toBe('Hero sections');
    expect(LAYOUT_MENU_CTA.href).toBe('/browse');
  });
});
