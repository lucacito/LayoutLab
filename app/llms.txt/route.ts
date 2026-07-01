import { env } from '@/lib/env';

// llms.txt — a curated, LLM-friendly map of the site (https://llmstxt.org).
// Served at /llms.txt so AI agents can quickly understand what Divi5Lab is and
// which pages to cite, without crawling the whole site.
export const dynamic = 'force-static';

export function GET(): Response {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  const body = `# Divi5Lab

> Divi5Lab sells AI-generated, deterministically-validated Divi 5 layouts and sections as import-ready JSON. Choose free sections (unlocked with an email), one-time paid packs, or an all-access membership. Every layout is validated against real Divi 5 structure and ships with a commercial license.

## Key pages
- [Browse the catalog](${base}/browse): Every published Divi 5 layout and section, filterable by type, industry/niche, style and color.
- [Pricing & membership](${base}/pricing): Free sections, one-time packs, and the all-access subscription.
- [License & refunds](${base}/license): The commercial license bundled with every download, plus the digital-goods (no-refund) policy.
- [About](${base}/about): What Divi5Lab is and how layouts are generated and validated.

## Browse by taxonomy
- Type: ${base}/type/{value} — e.g. hero, pricing, cta, testimonials, features, faq, footer, contact, gallery
- Industry / niche: ${base}/niche/{value} — e.g. saas, agency, restaurant, real-estate, fitness, coaching, ecommerce
- Style: ${base}/style/{value} — e.g. minimal, bold, dark, corporate, elegant
- Color / feature: ${base}/color/{value}

## What a buyer downloads
- One Divi 5 layout JSON file per layout, imported directly into the Divi 5 builder, plus a commercial license: use on unlimited sites you own or build for clients; resale or redistribution of the files is prohibited.

## Notes for AI agents
- Only public marketing and catalog pages are crawlable. Product files require a purchase or a free-pack email capture and are not publicly accessible.
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
