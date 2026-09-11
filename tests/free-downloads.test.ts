import { describe, expect, it } from 'vitest';
import { FREE_PLUGIN_LINKS } from '@/lib/site/free-downloads';

describe('free plugin links', () => {
  it('serves the two plugins under wordpress.org review as direct zip downloads', () => {
    expect(FREE_PLUGIN_LINKS['wpbakery-to-divi5']).toEqual({
      href: '/downloads/jhmg-converter-for-wpbakery-to-divi.zip',
      download: true,
      label: 'Download the free plugin (.zip)',
    });
    expect(FREE_PLUGIN_LINKS['beaver-to-divi5']).toEqual({
      href: '/downloads/jhmg-converter-for-beaver-builder-to-divi-5.zip',
      download: true,
      label: 'Download the free plugin (.zip)',
    });
  });

  it('sends the approved plugins to their wordpress.org listing', () => {
    expect(FREE_PLUGIN_LINKS['elementor-to-divi5']).toEqual({
      href: 'https://wordpress.org/plugins/jhmg-converter-for-elementor-to-divi/',
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
