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
