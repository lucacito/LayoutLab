export function productJsonLd(p: {
  name: string;
  description?: string | null;
  image?: string;
  url: string;
  offer?: { priceCents: number; currency?: string };
}) {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    url: p.url,
  };
  if (p.description) base.description = p.description;
  if (p.image) base.image = p.image;
  if (p.offer) {
    base.offers = {
      '@type': 'Offer',
      price: (p.offer.priceCents / 100).toFixed(2),
      priceCurrency: p.offer.currency ?? 'USD',
      availability: 'https://schema.org/InStock',
      url: p.url,
    };
  }
  return base;
}

export function itemListJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: it.url,
    })),
  };
}

export function breadcrumbJsonLd(crumbs: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
}

// Site-wide brand entity. Feeds Google's Knowledge Graph so "Divi5Lab" is
// understood as an organization/brand (entity SEO), not just a keyword.
// Add real profile URLs to `sameAs` (X, GitHub, LinkedIn, YouTube…) as they go
// live — sameAs is the strongest signal tying the brand to its off-site entities.
export function organizationJsonLd(o: {
  name: string;
  url: string;
  logo?: string;
  description?: string;
  sameAs?: string[];
}) {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: o.name,
    url: o.url,
  };
  if (o.logo) base.logo = o.logo;
  if (o.description) base.description = o.description;
  if (o.sameAs && o.sameAs.length) base.sameAs = o.sameAs;
  return base;
}

// Site entity + sitelinks search box. When Google honors it, the brand SERP
// result gains a search box that deep-links into /browse.
export function websiteJsonLd(w: { name: string; url: string; searchUrlTemplate?: string }) {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: w.name,
    url: w.url,
  };
  if (w.searchUrlTemplate) {
    base.potentialAction = {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: w.searchUrlTemplate },
      'query-input': 'required name=search_term_string',
    };
  }
  return base;
}

// Marks a catalog/listing page (e.g. /browse) as a canonical CollectionPage —
// reinforces it as the money page for the head term.
export function collectionPageJsonLd(c: { name: string; description?: string; url: string }) {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: c.name,
    url: c.url,
  };
  if (c.description) base.description = c.description;
  return base;
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.answer },
    })),
  };
}
