import { env } from '@/lib/env';

// llms.txt: a curated, LLM-friendly map of the site (https://llmstxt.org).
// Served at /llms.txt so AI agents can quickly understand what Divi5Lab is and
// which pages to cite, without crawling the whole site.
export const dynamic = 'force-static';

export function GET(): Response {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  const body = `# Divi5Lab

> Divi5Lab is home to the AI Editor for Divi 5: a free WordPress plugin that turns your site into an MCP server for Divi 5, with 21 AI editing tools that work with Claude, ChatGPT, Cursor and VS Code Copilot. It reads, edits and builds Divi 5 pages and Divi Projects, supports the Divi 5 Loop Builder (lists of posts, products, categories and menu items), and ships 75 section patterns, 10 design languages and 40 style kits. Every AI edit passes a deterministic validator (90 Divi 5 block types) before it is saved, new pages are drafts, changes can be previewed and AI edits can be undone. Pro add-on adds 23 more tools: whole-site build, restyling to another design language, Theme Builder header, footer and body editing, mega menus, site audit, find and replace, WooCommerce product and price tools, and more. We also offer converters for Elementor, Beaver Builder, WPBakery and Bricks, and a library of free validated Divi 5 layouts for what you build next.

## Key pages
- [Divi 5 MCP server](${base}/divi-5-mcp): What the MCP server for Divi 5 is, which assistants connect (Claude, ChatGPT, Cursor, Windsurf, VS Code Copilot), every tool grouped by what it does, and FAQ.
- [AI Editor for Divi 5](${base}/plugins/divi-5-ai-editor): Free plugin that lets Claude, ChatGPT, Cursor and VS Code Copilot edit Divi 5 pages safely. 21 free tools, 23 more in Pro.
- [Plugins and converters](${base}/plugins): The AI Editor, plus converters (Elementor, Beaver Builder, WPBakery, Bricks to Divi 5) and reverse converter (Divi to Elementor).
- [Pricing](${base}/pricing): Pro add-on licenses by annual site count, with a free trial.
- [Elementor to Divi 5](${base}/plugins/elementor-to-divi-5): Convert Elementor pages, kits and headers/footers into Divi 5.
- [Beaver Builder to Divi 5](${base}/plugins/beaver-builder-to-divi-5): Convert Beaver Builder pages and Themer layouts into Divi 5.
- [WPBakery to Divi 5](${base}/plugins/wpbakery-to-divi-5): Convert WPBakery shortcode pages and templates into Divi 5.
- [Bricks to Divi 5](${base}/plugins/bricks-to-divi-5): Convert Bricks pages, templates and WooCommerce elements into Divi 5.
- [Divi to Elementor](${base}/plugins/divi-to-elementor): Batch-convert Divi sites into Elementor.
- [Browse the catalog](${base}/browse): Free validated Divi 5 layouts, filterable by type, industry/niche, style and color.
- [License & refunds](${base}/license): The commercial license bundled with every download, plus the digital-goods (no-refund) policy.
- [About](${base}/about): What Divi5Lab is and how layouts are generated and validated.

## Browse by taxonomy
- Type: ${base}/type/{value}, e.g. hero, pricing, cta, testimonials, features, faq, footer, contact, gallery
- Industry / niche: ${base}/niche/{value}, e.g. saas, agency, restaurant, real-estate, fitness, coaching, ecommerce
- Style: ${base}/style/{value}, e.g. minimal, bold, dark, corporate, elegant
- Color / feature: ${base}/color/{value}

## What you download
- One Divi 5 layout JSON file per layout, imported directly into the Divi 5 builder, plus a commercial license: use on unlimited sites you own or build for clients; resale or redistribution of the files is prohibited. Free: an email address is the only requirement.
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
