import { describe, it, expect } from 'vitest';
import { buildLayoutMetadata, buildPackMetadata, productJsonLd, itemListJsonLd, breadcrumbJsonLd, organizationJsonLd, websiteJsonLd, collectionPageJsonLd, siteNavigationJsonLd, organizationId, websiteId } from '@/lib/seo';

const SITE = 'https://divi5lab.com';

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

  it('productJsonLd renders a valid $0.00 Offer for free items', () => {
    const ld = productJsonLd({ name: 'Free Layout', url: `${SITE}/layouts/x`, offer: { priceCents: 0 } });
    expect((ld as any).offers.price).toBe('0.00');
    expect((ld as any).offers.priceCurrency).toBe('USD');
  });

  it('productJsonLd includes aggregateRating only when there are real ratings', () => {
    const rated = productJsonLd({ name: 'L', url: `${SITE}/layouts/x`, offer: { priceCents: 0 }, aggregateRating: { ratingValue: 4.5, ratingCount: 12 } });
    expect((rated as any).aggregateRating['@type']).toBe('AggregateRating');
    expect((rated as any).aggregateRating.ratingValue).toBe('4.5');
    expect((rated as any).aggregateRating.ratingCount).toBe(12);

    const unrated = productJsonLd({ name: 'L', url: `${SITE}/layouts/x`, offer: { priceCents: 0 }, aggregateRating: { ratingValue: 0, ratingCount: 0 } });
    expect('aggregateRating' in unrated).toBe(false);
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

  it('organizationJsonLd emits an Organization entity with logo', () => {
    const ld = organizationJsonLd({ name: 'Divi5Lab', url: SITE, logo: `${SITE}/divi5lab-logo.png` });
    expect(ld['@type']).toBe('Organization');
    expect(ld.name).toBe('Divi5Lab');
    expect(ld.url).toBe(SITE);
    expect((ld as any).logo).toBe(`${SITE}/divi5lab-logo.png`);
  });

  it('organizationJsonLd omits sameAs when there are no profiles', () => {
    const ld = organizationJsonLd({ name: 'Divi5Lab', url: SITE });
    expect('sameAs' in ld).toBe(false);
  });

  it('organizationJsonLd includes sameAs when profiles are provided', () => {
    const ld = organizationJsonLd({ name: 'Divi5Lab', url: SITE, sameAs: ['https://x.com/divi5lab'] });
    expect((ld as any).sameAs).toEqual(['https://x.com/divi5lab']);
  });

  it('websiteJsonLd emits a WebSite with a sitelinks SearchAction', () => {
    const ld = websiteJsonLd({ name: 'Divi5Lab', url: SITE, searchUrlTemplate: `${SITE}/browse?q={search_term_string}` });
    expect(ld['@type']).toBe('WebSite');
    const action = (ld as any).potentialAction;
    expect(action['@type']).toBe('SearchAction');
    expect(action.target.urlTemplate).toBe(`${SITE}/browse?q={search_term_string}`);
    expect(action['query-input']).toBe('required name=search_term_string');
  });

  it('websiteJsonLd omits potentialAction when no search template is given', () => {
    const ld = websiteJsonLd({ name: 'Divi5Lab', url: SITE });
    expect('potentialAction' in ld).toBe(false);
  });

  it('organizationJsonLd carries a stable @id and a support contactPoint', () => {
    const ld = organizationJsonLd({ name: 'Divi5Lab', url: SITE, email: 'support@divi5lab.com' });
    expect(ld['@id']).toBe(`${SITE}/#organization`);
    expect((ld as any).contactPoint.email).toBe('support@divi5lab.com');
  });

  it('websiteJsonLd links back to the Organization node via publisher @id', () => {
    const ld = websiteJsonLd({ name: 'Divi5Lab', url: SITE, publisherId: organizationId(SITE) });
    expect(ld['@id']).toBe(websiteId(SITE));
    expect((ld as any).publisher['@id']).toBe(`${SITE}/#organization`);
    expect((ld as any).inLanguage).toBe('en');
  });

  it('siteNavigationJsonLd emits SiteNavigationElement items in order', () => {
    const ld = siteNavigationJsonLd([{ name: 'Browse', url: `${SITE}/browse` }, { name: 'Pricing', url: `${SITE}/pricing` }]);
    expect(ld.itemListElement[0]['@type']).toBe('SiteNavigationElement');
    expect(ld.itemListElement[0].position).toBe(1);
    expect(ld.itemListElement[1].url).toBe(`${SITE}/pricing`);
  });

  it('collectionPageJsonLd marks a listing page as a CollectionPage', () => {
    const ld = collectionPageJsonLd({ name: 'Free Divi 5 Layouts', url: `${SITE}/browse`, description: 'All layouts' });
    expect(ld['@type']).toBe('CollectionPage');
    expect(ld.url).toBe(`${SITE}/browse`);
    expect((ld as any).description).toBe('All layouts');
  });
});
