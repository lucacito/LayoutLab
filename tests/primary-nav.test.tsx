import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PrimaryNav } from '@/components/site/PrimaryNav';

describe('PrimaryNav', () => {
  it('renders Plugins, Free layouts (→/browse) and Guides, with no standalone Browse item', () => {
    const { getByText, queryAllByText } = render(<PrimaryNav />);
    const plugins = getByText('Plugins').closest('a');
    const layouts = getByText('Free layouts').closest('a');
    const guides = getByText('Guides').closest('a');
    expect(plugins?.getAttribute('href')).toBe('/plugins');
    expect(layouts?.getAttribute('href')).toBe('/browse');
    expect(guides?.getAttribute('href')).toBe('/guides');
    // No nav link whose visible text is exactly "Browse".
    expect(queryAllByText('Browse')).toHaveLength(0);
  });

  it('keeps the mega-menu links in the DOM (crawlable): plugins + taxonomy', () => {
    const { getByText } = render(<PrimaryNav />);
    // A plugin from the Plugins panel.
    expect(getByText('AI Editor for Divi 5').closest('a')?.getAttribute('href')).toBe('/plugins/divi-5-ai-editor');
    // A taxonomy link from the Free-layouts panel.
    expect(getByText('Hero sections').closest('a')?.getAttribute('href')).toBe('/type/hero');
    // The "Browse all layouts" CTA inside the panel points to the catalog.
    expect(getByText('Browse all layouts').closest('a')?.getAttribute('href')).toBe('/browse');
  });

  it('hangs each mega panel from the nav with no empty gap (padding bridge, never a margin)', () => {
    const { container } = render(<PrimaryNav />);
    const panels = Array.from(container.querySelectorAll('[data-mega-panel]'));
    expect(panels).toHaveLength(2);
    for (const el of panels) {
      const cls = el.getAttribute('class') ?? '';
      // A margin above the panel leaves a strip that is neither nav nor panel: the pointer leaves the nav while crossing
      // it and the panel closes. The breathing room is padding on this wrapper, so the pointer is always over something.
      expect(cls).toMatch(/\bpt-4\b/);
      expect(cls).not.toMatch(/\bmt-\d/);
      expect(cls).toMatch(/\btop-full\b/);
      // The visible card is the child, not the wrapper.
      expect(el.firstElementChild?.getAttribute('class') ?? '').toMatch(/bg-paper/);
    }
  });
});
