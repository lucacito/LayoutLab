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
