import { describe, it, expect } from 'vitest';
import { buildLayoutMetadata, buildPackMetadata, productJsonLd, itemListJsonLd, breadcrumbJsonLd } from '@/lib/seo';

const SITE = 'https://layoutlab.com';

describe('buildLayoutMetadata', () => {
  it('sets title, canonical, and OG image', () => {
    const m = buildLayoutMetadata({ title: 'Bold SaaS Hero', slug: 'bold-saas-hero', ogImage: 'https://img/x.png', siteUrl: SITE });
    expect(m.title).toBe('Bold SaaS Hero');
    expect(m.alternates?.canonical).toBe(`${SITE}/layouts/bold-saas-hero`);
    expect((m.openGraph as any)?.images?.[0]?.url).toBe('https://img/x.png');
  });

  it('falls back to a generated description when none given', () => {
    const m = buildLayoutMetadata({ title: 'Hero', slug: 'hero', siteUrl: SITE });
    expect(typeof m.description).toBe('string');
    expect((m.description as string).length).toBeGreaterThan(0);
  });
});

describe('buildPackMetadata', () => {
  it('canonicalizes to the packs path', () => {
    const m = buildPackMetadata({ title: '100 Landing Pages', slug: 'landing-100', siteUrl: SITE });
    expect(m.alternates?.canonical).toBe(`${SITE}/packs/landing-100`);
  });

  it('falls back to a pack-oriented description when none given', () => {
    const m = buildPackMetadata({ title: '100 Landing Pages', slug: 'landing-100', siteUrl: SITE });
    const desc = m.description as string;
    expect(desc).toContain('pack');
    expect(desc).not.toContain('layout:');
  });
});

describe('json-ld', () => {
  it('productJsonLd includes an offer when price is provided', () => {
    const ld = productJsonLd({ name: 'Pack', url: `${SITE}/packs/x`, offer: { priceCents: 4900 } });
    expect(ld['@type']).toBe('Product');
    expect((ld as any).offers.price).toBe('49.00');
    expect((ld as any).offers.priceCurrency).toBe('USD');
  });

  it('productJsonLd omits offers when no price is given', () => {
    const ld = productJsonLd({ name: 'Layout', url: `${SITE}/layouts/x` });
    expect('offers' in ld).toBe(false);
  });

  it('itemListJsonLd numbers positions from 1', () => {
    const ld = itemListJsonLd([{ name: 'a', url: 'u1' }, { name: 'b', url: 'u2' }]);
    expect(ld.itemListElement).toHaveLength(2);
    expect(ld.itemListElement[0].position).toBe(1);
    expect(ld.itemListElement[1].position).toBe(2);
  });

  it('breadcrumbJsonLd maps crumbs to ListItems', () => {
    const ld = breadcrumbJsonLd([{ name: 'Home', url: SITE }, { name: 'Browse', url: `${SITE}/browse` }]);
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld.itemListElement[1].item).toBe(`${SITE}/browse`);
  });
});
