// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BricksPage, { metadata } from '@/app/(marketing)/plugins/bricks-to-divi-5/page';
import {
  BRICKS_ELEMENT_GROUPS,
  BRICKS_ELEMENT_TYPES_MAPPED,
  BRICKS_WOO_ELEMENT_GROUPS,
  BRICKS_WOO_ELEMENT_TYPES_MAPPED,
} from '@/lib/site/bricks-element-mappings';
import { env } from '@/lib/env';

describe('lib/site/bricks-element-mappings', () => {
  it('counts the 34 free element types and the 41 Pro WooCommerce element types from the plugin registries', () => {
    // HandlerRegistry::defaults() holds 35 names; map-connector produces no module and is not listed.
    expect(BRICKS_ELEMENT_TYPES_MAPPED).toBe(34);
    expect(BRICKS_ELEMENT_TYPES_MAPPED).toBe(BRICKS_ELEMENT_GROUPS.reduce((n, g) => n + g.elements.length, 0));
    // The Pro add-on's brdc_woocommerce_handlers list.
    expect(BRICKS_WOO_ELEMENT_TYPES_MAPPED).toBe(41);
    expect(BRICKS_WOO_ELEMENT_TYPES_MAPPED).toBe(BRICKS_WOO_ELEMENT_GROUPS.reduce((n, g) => n + g.elements.length, 0));
  });

  it('never repeats an element across groups, free or Pro', () => {
    const all = [...BRICKS_ELEMENT_GROUPS, ...BRICKS_WOO_ELEMENT_GROUPS].flatMap((g) => g.elements);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('/plugins/bricks-to-divi-5', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (env as Record<string, unknown>).STRIPE_PRICE_BRICKS2DIVI_PRO;
  });

  it('sends the free plugin to its wordpress.org listing, never a zip', () => {
    render(<BricksPage />);
    const free = screen.getAllByRole('link', { name: /free plugin/i });
    expect(free.length).toBeGreaterThan(0);
    for (const link of free) {
      expect(link.getAttribute('href')).toBe('https://wordpress.org/plugins/jhmg-converter-for-bricks-to-divi-5/');
      expect(link.hasAttribute('download')).toBe(false);
    }
    expect(screen.queryByText(/\.zip/i)).toBeNull();
    expect(screen.queryByText(/under review/i)).toBeNull();
  });

  it('shows a Buy button only once the Stripe price exists, and says so honestly until then', () => {
    render(<BricksPage />);
    expect(screen.queryByRole('button', { name: /get pro/i })).toBeNull();
    expect(screen.getAllByText(/pro opens shortly/i).length).toBeGreaterThan(0);
  });

  it('sells Pro at $25/yr when the Stripe price is configured', () => {
    (env as Record<string, unknown>).STRIPE_PRICE_BRICKS2DIVI_PRO = 'price_test_123';
    render(<BricksPage />);
    expect(screen.getAllByRole('button', { name: /get pro · \$25\/yr/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/pro opens shortly/i)).toBeNull();
  });

  it('is honest that free converts one page per run and Pro unlimited', () => {
    render(<BricksPage />);
    const row = screen.getByRole('rowheader', { name: 'Pages per run' }).closest('tr');
    expect(within(row!).getByText('1')).toBeTruthy();
    expect(within(row!).getByText('Unlimited')).toBeTruthy();
  });

  it('states what does not convert, and never claims to touch or undo Bricks pages', () => {
    render(<BricksPage />);
    expect(screen.getByText(/CSS grid layouts are approximated/i)).toBeTruthy();
    expect(screen.getByText(/conditions are not evaluated/i)).toBeTruthy();
    expect(screen.getAllByText(/never modified|never touched|untouched/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/one-click undo|undo any run/i)).toBeNull();
  });

  it('lists every converted element type in the mapping reference', () => {
    render(<BricksPage />);
    for (const e of ['heading', 'accordion-nested', 'post-sharing', 'woocommerce-checkout-v2']) {
      expect(screen.getAllByText(e).length).toBeGreaterThan(0);
    }
  });

  it('has metadata that names the converter', () => {
    expect(String(metadata.title)).toMatch(/bricks to divi 5/i);
    expect(String(metadata.description)).toMatch(/bricks/i);
    expect(metadata.alternates?.canonical).toMatch(/\/plugins\/bricks-to-divi-5$/);
  });
});
