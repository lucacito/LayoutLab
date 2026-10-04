import { describe, expect, it } from 'vitest';
import { FREE_PLUGIN_LINKS } from '@/lib/site/free-downloads';

describe('free plugin links', () => {
  it('sends every approved plugin to its wordpress.org listing, WPBakery included', () => {
    expect(FREE_PLUGIN_LINKS['wpbakery-to-divi5']).toEqual({
      href: 'https://wordpress.org/plugins/jhmg-converter-for-wpbakery-to-divi-5/',
      download: false,
      label: 'Get the free plugin on wordpress.org',
    });
    expect(FREE_PLUGIN_LINKS['elementor-to-divi5']).toEqual({
      href: 'https://wordpress.org/plugins/jhmg-converter-for-elementor-to-divi/',
      download: false,
      label: 'Get the free plugin on wordpress.org',
    });
    expect(FREE_PLUGIN_LINKS['beaver-to-divi5']).toEqual({
      href: 'https://wordpress.org/plugins/jhmg-converter-for-beaver-builder-to-divi-5/',
      download: false,
      label: 'Get the free plugin on wordpress.org',
    });
    expect(FREE_PLUGIN_LINKS['divi-to-elementor']).toEqual({
      href: 'https://wordpress.org/plugins/jhmg-converter-for-divi-to-elementor/',
      download: false,
      label: 'Get the free plugin on wordpress.org',
    });
  });
});

describe('the free AI Editor link', () => {
  it('goes to the wordpress.org listing, never to a bundled zip that can go stale (the Pro add-on needs the current free plugin)', () => {
    const link = FREE_PLUGIN_LINKS['ai-editor-divi5'];
    expect(link.href).toBe('https://wordpress.org/plugins/jhmg-ai-editor-for-divi-5/');
    expect(link.download).toBe(false);
    expect(link.href).not.toMatch(/\.zip$/);
  });
});
