import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { LAYOUT_MENU_COLUMNS } from '@/lib/nav/menu-data';

const COUNTS = { type: { hero: 63, cards: 73 }, niche: { saas: 40 }, style: { dark: 12 } };

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => COUNTS })));
});

describe('menu layout counts', () => {
  it('gives every taxonomy link a facet, and no other menu link', () => {
    for (const col of LAYOUT_MENU_COLUMNS) for (const l of col.links) expect(l.facet).toBeTruthy();
  });

  it('shows the count next to each entry once /api/menu-counts answers, and 0 for a facet with no layouts', async () => {
    const { PrimaryNav } = await import('@/components/site/PrimaryNav');
    const { container, getByText } = render(<PrimaryNav />);
    await waitFor(() => expect(container.querySelectorAll('[data-menu-count]').length).toBeGreaterThan(0));
    expect(getByText('Hero sections').closest('a')?.textContent).toContain('63');
    expect(getByText('Cards').closest('a')?.textContent).toContain('73');
    expect(getByText('FAQ sections').closest('a')?.textContent).toContain('0');
  });

  it('shows no counts, and still renders every link, when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const { PrimaryNav } = await import('@/components/site/PrimaryNav');
    const { container, getByText } = render(<PrimaryNav />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container.querySelectorAll('[data-menu-count]')).toHaveLength(0);
    expect(getByText('Hero sections').closest('a')?.getAttribute('href')).toBe('/type/hero');
  });
});
