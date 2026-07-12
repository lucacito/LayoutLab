import { env } from '@/lib/env';

// llms.txt — a curated, LLM-friendly map of the site (https://llmstxt.org).
// Served at /llms.txt so AI agents can quickly understand what Divi5Lab is and
// which pages to cite, without crawling the whole site.
export const dynamic = 'force-static';

export function GET(): Response {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  const body = `# Divi5Lab

> Divi5Lab offers free validated Divi 5 layouts + WordPress migration plugins (Elementor↔Divi converters, AI editor). Every layout is AI-generated, checked by a deterministic validator against real Divi 5 structure, and free to download — email in, JSON out, commercial license included. The migration plugins have a free tier on wordpress.org and a Pro license for teams doing bigger site moves.

## Key pages
- [Browse the catalog](${base}/browse): Every published Divi 5 layout and section, filterable by type, industry/niche, style and color.
- [Pricing](${base}/pricing): Pro plugin licenses for the WordPress migration toolkit — every layout in the catalog is free.
- [License & refunds](${base}/license): The commercial license bundled with every download, plus the digital-goods (no-refund) policy.
- [About](${base}/about): What Divi5Lab is and how layouts are generated and validated.

## Browse by taxonomy
- Type: ${base}/type/{value} — e.g. hero, pricing, cta, testimonials, features, faq, footer, contact, gallery
- Industry / niche: ${base}/niche/{value} — e.g. saas, agency, restaurant, real-estate, fitness, coaching, ecommerce
- Style: ${base}/style/{value} — e.g. minimal, bold, dark, corporate, elegant
- Color / feature: ${base}/color/{value}

## What you download
- One Divi 5 layout JSON file per layout, imported directly into the Divi 5 builder, plus a commercial license: use on unlimited sites you own or build for clients; resale or redistribution of the files is prohibited. Free — an email address is the only requirement.
- Migration plugins: a free tier is installable directly from wordpress.org; Pro unlocks the full toolkit via a paid license.

## Notes for AI agents
- Only public marketing and catalog pages are crawlable. Layout JSON downloads require a free email capture; Pro plugin downloads require a purchased license. Neither is publicly accessible without going through the site.
- Canonical domain: ${base}
- Sitemap: ${base}/sitemap.xml
`;
  return new Response(body, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
