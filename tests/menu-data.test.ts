import { describe, it, expect } from 'vitest';
import { TYPE_LABELS, PRIMARY_NAV } from '@/lib/nav/menu-data';

describe('menu-data', () => {
  it('labels the cards type', () => {
    expect(TYPE_LABELS.cards).toBe('Cards');
  });

  it('defines the plugins-first PRIMARY_NAV contract', () => {
    expect(PRIMARY_NAV).toEqual([
      { key: 'plugins', label: 'Plugins', href: '/plugins' },
      { key: 'layouts', label: 'Free layouts', href: '/free-divi-layouts' },
      { key: 'browse', label: 'Browse', href: '/browse' },
      { key: 'guides', label: 'Guides', href: '/guides' },
    ]);
  });
});
