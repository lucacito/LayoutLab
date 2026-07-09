export function productJsonLd(p: {
  name: string;
  description?: string | null;
  image?: string;
  // Screenshot set as captioned ImageObjects — richer than a bare URL for
  // Google Images and product rich results. Wins over `image` when both given.
  images?: { url: string; caption: string }[];
  url: string;
  // Always pass an offer — Google requires every Product to carry one of
  // `offers` / `review` / `aggregateRating`, else Search Console flags it. Free
  // items pass `{ priceCents: 0 }`, which renders a valid $0.00 Offer.
  offer?: { priceCents: number; currency?: string };
  // Only pass when real ratings exist (ratingCount > 0). Never fabricate — an
  // empty/fake aggregateRating is a manual-action risk.
  aggregateRating?: { ratingValue: number; ratingCount: number };
}) {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    url: p.url,
  };
  if (p.description) base.description = p.description;
  if (p.images && p.images.length) {
    base.image = p.images.map((im) => ({ '@type': 'ImageObject', contentUrl: im.url, caption: im.caption }));
  } else if (p.image) {
    base.image = p.image;
  }
  if (p.offer) {
    base.offers = {
      '@type': 'Offer',
      price: (p.offer.priceCents / 100).toFixed(2),
      priceCurrency: p.offer.currency ?? 'USD',
      availability: 'https://schema.org/InStock',
      url: p.url,
    };
  }
  if (p.aggregateRating && p.aggregateRating.ratingCount > 0) {
    base.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: p.aggregateRating.ratingValue.toFixed(1),
      ratingCount: p.aggregateRating.ratingCount,
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
// A stable `@id` for the brand entity so the WebSite (and any Product/page) can
// reference the *same* Organization node instead of Google having to guess that
// two loose Organization blobs are the same thing. `#organization` is the
// conventional fragment for this node.
export function organizationId(siteUrl: string) {
  return `${siteUrl.replace(/\/+$/, '')}/#organization`;
}
export function websiteId(siteUrl: string) {
  return `${siteUrl.replace(/\/+$/, '')}/#website`;
}

export function organizationJsonLd(o: {
  name: string;
  url: string;
  logo?: string;
  description?: string;
  sameAs?: string[];
  email?: string;
}) {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': organizationId(o.url),
    name: o.name,
    url: o.url,
  };
  if (o.logo) base.logo = o.logo;
  if (o.description) base.description = o.description;
  if (o.email) {
    base.contactPoint = { '@type': 'ContactPoint', email: o.email, contactType: 'customer support' };
  }
  if (o.sameAs && o.sameAs.length) base.sameAs = o.sameAs;
  return base;
}

// Site entity + sitelinks search box. When Google honors it, the brand SERP
// result gains a search box that deep-links into /browse. `publisher` ties the
// site back to the Organization node (same `@id`) so Google reads one coherent
// brand, which is a prerequisite for the sitelinks search box being shown.
export function websiteJsonLd(w: { name: string; url: string; searchUrlTemplate?: string; publisherId?: string }) {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': websiteId(w.url),
    name: w.name,
    url: w.url,
    inLanguage: 'en',
  };
  if (w.publisherId) base.publisher = { '@id': w.publisherId };
  if (w.searchUrlTemplate) {
    base.potentialAction = {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: w.searchUrlTemplate },
      'query-input': 'required name=search_term_string',
    };
  }
  return base;
}

// Declares the site's primary navigation as first-class structured data. Google
// uses the main nav (and its anchor text) as its strongest hint for *which*
// pages deserve to become sitelinks; spelling it out removes ambiguity.
export function siteNavigationJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Primary navigation',
    itemListElement: items.map((it, i) => ({
      '@type': 'SiteNavigationElement',
      position: i + 1,
      name: it.name,
      url: it.url,
    })),
  };
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

// Editorial content (guides). `author` is the brand Organization — there is no
// human byline to fabricate. `publisher` references the sitewide Organization
// node by @id so all Articles roll up to one brand entity.
export function articleJsonLd(a: {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  authorName: string;
  publisherId?: string;
  image?: string;
}) {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.headline,
    description: a.description,
    url: a.url,
    mainEntityOfPage: a.url,
    datePublished: a.datePublished,
    author: { '@type': 'Organization', name: a.authorName },
    inLanguage: 'en',
  };
  if (a.dateModified) base.dateModified = a.dateModified;
  if (a.publisherId) base.publisher = { '@id': a.publisherId };
  if (a.image) base.image = a.image;
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
