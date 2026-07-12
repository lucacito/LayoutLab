import type { CatalogFilters } from '@/lib/catalog/filters';

// Programmatic keyword landing pages. Each entry is a real, content-complete
// landing page targeting one broad "Divi layouts/templates" query the catalog
// can genuinely serve. Copy lives in-repo (not the DB) so it ships atomically
// with the route and is reviewable in diffs. Rendered by app/(catalog)/[keyword].
//
// Rules (enforced by tests/seo-keyword-pages.test.ts):
// - slug never collides with a real top-level route
// - filters only reference AXIS_VALUES
// - metaTitle ≤ 65 chars; metaDescription 100–165; intro ≥ 200 words
// - related slugs resolve inside this registry
export interface KeywordPage {
  slug: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  /** Markdown intro rendered above the layout grid. */
  intro: string;
  /** Catalog query for the grid. Empty object = whole published catalog. */
  filters: Partial<Pick<CatalogFilters, 'type' | 'niche' | 'style'>>;
  /** Bias the page toward the free story (copy + CTA), not a different query. */
  freeOnly?: boolean;
  faq: { question: string; answer: string }[];
  /** Slugs of sibling keyword pages to cross-link. */
  related: string[];
}

const LICENSE_FAQ = {
  question: 'Can I use these layouts on client sites?',
  answer:
    'Yes. Every download ships with a commercial license that covers unlimited sites you own or build for clients. The only thing you cannot do is resell or redistribute the layout files themselves.',
};

const IMPORT_FAQ = {
  question: 'How do I import a layout into Divi?',
  answer:
    'Download the JSON file, open your page in the Divi 5 builder, use the portability (import/export) option, and upload the file. The sections appear in the builder immediately — no plugin, no shortcodes, no cleanup.',
};

const DIVI4_FAQ = {
  question: 'Do these work with Divi 4?',
  answer:
    'They are built and validated for Divi 5. Divi 5 imports its own JSON format, so we recommend upgrading — Elegant Themes ships Divi 5 as the current builder, and every layout here is tested against its real module structure.',
};

export const KEYWORD_PAGES: Record<string, KeywordPage> = {
  'divi-layouts': {
    slug: 'divi-layouts',
    h1: 'Divi Layouts — Ready-to-Import Sections & Pages',
    metaTitle: 'Divi Layouts — Free Divi 5 Sections and Pages',
    metaDescription:
      'Browse hundreds of Divi layouts built for Divi 5. Free downloads, validated JSON imports, responsive on every device, commercial license included.',
    intro: `Every Divi layout in this library is built the way you would build it yourself — with real Divi modules, sensible section structure, and global-preset-friendly styling — then run through a deterministic validator that checks the JSON against Divi 5's actual module schema before it is allowed anywhere near the catalog. No screenshots of hand-wavy mockups, no "compatible with page builders" ambiguity: what you download is a Divi JSON file that imports cleanly into the builder in seconds.

The library covers the sections you actually ship: hero sections, pricing tables, testimonials, feature grids, FAQs, contact sections, galleries, footers, and complete landing pages. Layouts are organized across four axes — section type, industry, visual style, and color — so you can go from "I need a dark SaaS hero" to a working section in under a minute. Every layout page shows full desktop and mobile screenshots so you can judge the design honestly before downloading.

Every layout here is free — single sections and curated multi-page packs alike. Drop your email and the JSON is yours, with a commercial license that covers unlimited client work, no upsell hidden inside the file. If you're migrating an existing site into Divi 5 rather than building fresh, our Elementor → Divi 5 converter plugin moves the whole site over for you.

Because layouts are generated and validated as a pipeline rather than hand-assembled once and forgotten, the catalog grows continuously and every new layout meets the same structural bar. If a layout is listed here, it imports — that is the contract. Start with the newest additions below, or jump into a specific section type or industry using the category links further down the page.`,
    filters: {},
    faq: [
      IMPORT_FAQ,
      LICENSE_FAQ,
      DIVI4_FAQ,
      {
        question: 'Are these layouts really free?',
        answer:
          'Yes, all of them. Individual sections and curated multi-page packs are both free — you trade an email address for the download. There is no trial-window trick and nothing paywalled behind a subscription: a free download is yours permanently.',
      },
    ],
    related: ['divi-templates', 'divi-sections', 'free-divi-layouts', 'divi-landing-pages'],
  },

  'divi-templates': {
    slug: 'divi-templates',
    h1: 'Divi Templates for Every Section and Page',
    metaTitle: 'Divi Templates — Download Validated Divi 5 Templates',
    metaDescription:
      'Divi templates that import clean: validated Divi 5 JSON for heroes, pricing, landing pages and more. Free downloads with a commercial license.',
    intro: `A Divi template should save you time twice: once when you skip designing from a blank canvas, and again when you don't have to repair what you imported. Most template marketplaces only deliver the first half. Ours are different by construction — every template in this catalog is validated against Divi 5's real module structure before publication, so the file you import behaves like something a careful designer built directly in your builder.

Templates here span single sections (heroes, pricing tables, testimonial walls, feature grids, FAQ accordions, contact blocks, footers) and full pages composed from those sections with a consistent palette, typography scale, and spacing rhythm. Each template is tagged by industry — SaaS, agency, restaurant, real estate, fitness, coaching, e-commerce, nonprofit and more — and by visual style, from minimal and corporate to bold and dark. That taxonomy is browsable, so "elegant real-estate landing" or "playful pricing section" is a two-click search rather than twenty minutes of scrolling.

Downloading is deliberately boring: pick a template, look at the real desktop and mobile screenshots, download the JSON, import it through Divi's portability panel, and start swapping in your content. Sections and multi-page packs are both free with an email address — the whole library, no subscription wall in front of any of it.

Everything ships with the same commercial license — build for yourself or for clients on as many sites as you like. And because the pipeline keeps generating and validating new designs weekly, the template you need next month will probably be here before you go looking for it.`,
    filters: {},
    faq: [
      {
        question: 'What makes these different from other Divi template shops?',
        answer:
          'Every template is checked by a deterministic validator against Divi 5’s actual module schema before it can be published. If the JSON structure is not exactly right, it never reaches the catalog — so imports don’t produce broken modules or missing settings.',
      },
      IMPORT_FAQ,
      LICENSE_FAQ,
      DIVI4_FAQ,
    ],
    related: ['divi-layouts', 'divi-5-templates', 'divi-website-templates', 'free-divi-templates'],
  },

  'divi-5-templates': {
    slug: 'divi-5-templates',
    h1: 'Divi 5 Templates — Built and Validated for the New Builder',
    metaTitle: 'Divi 5 Templates — Native, Validated, Import-Ready',
    metaDescription:
      'Templates made specifically for Divi 5 — native module structure, no legacy shortcodes, validated JSON. Download free sections or full landing pages.',
    intro: `Divi 5 is a genuinely different builder under the hood — a new rendering engine, flexbox-based layout options, cleaner presets, and a JSON format that is not just "Divi 4 with a version bump." Templates made for the old builder don't take advantage of any of that, and converted layouts tend to carry legacy baggage with them. Everything on this page was created natively for Divi 5: authored against its real module set, styled with its preset system in mind, and validated against its actual schema before publication.

That "validated" word is doing real work. Our generation pipeline runs every layout through a deterministic validator — the same check, the same verdict, every time — that confirms each module, attribute, and nesting level is legal Divi 5 structure. Layouts that fail never get published. The practical consequence for you: importing one of these templates is uneventful. Modules land configured, responsive settings are present, and nothing renders as a mystery gray box.

The catalog covers single sections — heroes, pricing, testimonials, features, FAQs, contact, galleries, footers — and complete landing pages composed with coherent palettes and typography. Filter by industry or style, preview real desktop and mobile screenshots, then download the JSON and import through the portability panel.

Individual sections and multi-page packs are both free with an email address — no subscription required for bigger projects. Every file includes a commercial license for unlimited sites, including client work. If you're moving an existing Elementor site to Divi 5 rather than building native from scratch, our Elementor → Divi 5 converter plugin handles that migration; if you're starting native, this is the shelf to start on.`,
    filters: {},
    faq: [
      {
        question: 'Are these converted Divi 4 layouts?',
        answer:
          'No. Every layout is generated natively for Divi 5 and validated against Divi 5’s module schema. Nothing here is a bulk-converted legacy file.',
      },
      IMPORT_FAQ,
      LICENSE_FAQ,
    ],
    related: ['divi-templates', 'divi-layouts', 'elegant-themes-layouts'],
  },

  'divi-landing-pages': {
    slug: 'divi-landing-pages',
    h1: 'Divi Landing Pages — Complete, Conversion-Focused Layouts',
    metaTitle: 'Divi Landing Pages — Full Divi 5 Landing Page Layouts',
    metaDescription:
      'Complete Divi 5 landing pages: hero to footer with pricing, proof and CTAs in one validated JSON import. Preview real screenshots, download, customize.',
    intro: `A landing page is a sequence, not a collection: hook in the hero, credibility right behind it, an offer explained in concrete terms, objections handled, and a call to action that appears exactly when a visitor is ready. The full landing pages in this section are composed that way from the start — each one is a hero-to-footer page where the sections were designed together, sharing one palette, one typography scale, and one spacing rhythm, so nothing feels bolted on.

Each landing page arrives as a single Divi 5 JSON file. Import it, and the entire page structure appears in the builder: hero, feature or service sections, social proof, pricing where it belongs, FAQ, closing CTA, footer. Swap the copy and imagery for your own, adjust the palette if you like, and publish. Because every page passed our deterministic validator before it was listed, the import step is drama-free — modules arrive configured and responsive settings are already in place.

The catalog spans the industries people actually build for: SaaS products, agencies, restaurants, real-estate brands, fitness studios, coaches, e-commerce, nonprofits, events and more. Desktop and mobile screenshots on every layout page show the full scroll, so you can evaluate the actual page — not a cropped hero shot — before downloading.

If you'd rather assemble your own sequence, pair a hero from one layout with pricing and testimonials from others; every section in the library shares the same structural standards. But when the deadline is tonight, importing one coherent landing page and swapping content is the fastest honest path to shipping.`,
    filters: { type: ['full_landing'] },
    faq: [
      {
        question: 'Do I get the whole page in one file?',
        answer:
          'Yes. A full landing layout is one Divi 5 JSON export containing every section from hero to footer, already styled to work together. One import gives you the complete page.',
      },
      IMPORT_FAQ,
      LICENSE_FAQ,
      {
        question: 'Can I mix sections from different landing pages?',
        answer:
          'Absolutely. Every section in the library follows the same structural standards, so you can import several layouts and combine sections in the builder. Matching palettes takes a few preset tweaks.',
      },
    ],
    related: ['divi-homepage-layouts', 'divi-website-templates', 'divi-hero-sections'],
  },

  'divi-sections': {
    slug: 'divi-sections',
    h1: 'Divi Sections — Heroes, Pricing, Testimonials & More',
    metaTitle: 'Divi Sections — Free Divi 5 Section Layouts to Import',
    metaDescription:
      'Free Divi 5 sections: heroes, pricing tables, testimonials, features, FAQs, contact blocks and footers. Validated JSON — import and customize in minutes.',
    intro: `Sections are the unit of real page-building. You rarely need someone else's whole website — you need a better hero than the one you have, a pricing table that doesn't look homemade, a testimonial wall with actual rhythm. This library is section-first for exactly that reason: thousands of visitors use it the way you'd use a parts shelf, pulling one validated piece at a time into pages they already own.

Every section type that carries a modern marketing site is here: hero sections with strong headline hierarchy, pricing tables in two, three and four columns, testimonial grids and carousels, feature sections with icon systems that actually match, FAQ accordions, contact sections with working form modules, image galleries, and footers that don't collapse on mobile. Each is tagged by industry and style, so you can filter down to "bold fitness hero" or "minimal SaaS pricing" instead of paging through everything.

The quality bar is structural, not just visual. Every section is generated against Divi 5's real module set and passes a deterministic validator before publication — the JSON you import is legal Divi 5 structure with responsive settings in place. Import through the portability panel, and the section drops into your page ready to restyle.

Sections are free to download with an email address, and the commercial license covers client work on unlimited sites. Browse the grid below, or jump to a section type — hero, pricing, testimonials, CTA, features, FAQ, contact, gallery, footer — from the category links.`,
    filters: {},
    faq: [
      {
        question: 'Can I import a section into an existing page?',
        answer:
          'Yes — that is the primary use case. Import the JSON through Divi’s portability panel and the section is added to your layout, where you can drag it into position among your existing sections.',
      },
      IMPORT_FAQ,
      LICENSE_FAQ,
    ],
    related: ['divi-hero-sections', 'divi-pricing-tables', 'divi-layouts', 'free-divi-layouts'],
  },

  'divi-hero-sections': {
    slug: 'divi-hero-sections',
    h1: 'Divi Hero Sections That Earn the Scroll',
    metaTitle: 'Divi Hero Sections — Free Divi 5 Hero Layouts',
    metaDescription:
      'Download free Divi 5 hero sections: strong headline hierarchy, real CTAs, responsive out of the box. Validated JSON imports for every industry and style.',
    intro: `The hero decides whether the rest of your page gets read. It has one job — say what you offer, to whom, and why it's credible, in the second before a visitor's thumb decides — and most heroes fail it with vague headlines and decorative clutter. The hero sections in this collection are built around that job: headline hierarchy that survives a squint test, a single primary call to action, supporting proof where it helps, and imagery that frames rather than fights the message.

Structurally, every hero here is native Divi 5: real modules, sane row and column structure, responsive settings tuned for the 390-pixel reality where most first impressions happen. Each one passed our deterministic validator before publication, so the JSON imports without surprises. Styles range from minimal and corporate to dark and bold; industries cover SaaS, agencies, restaurants, real estate, fitness, coaching, e-commerce, nonprofits and events. Desktop and mobile screenshots on each layout page show exactly how the hero holds up at both extremes.

A practical tip from building hundreds of these: pick the hero whose *structure* matches your message — headline-left with product visual, centered statement with dual CTAs, split hero with form — and worry about colors second. Palette is a five-minute preset change in Divi 5; structure is the part worth choosing carefully.

Every hero is a free download with an email address, licensed for unlimited commercial use. Import one, replace the copy, and your page's most important 800 pixels are handled.`,
    filters: { type: ['hero'] },
    faq: [
      {
        question: 'Do the hero CTAs and buttons work after import?',
        answer:
          'Yes. Buttons are real Divi button modules — you set the link target after import. Nothing is a flattened image or placeholder graphic.',
      },
      IMPORT_FAQ,
      LICENSE_FAQ,
    ],
    related: ['divi-sections', 'divi-landing-pages', 'divi-layouts'],
  },

  'divi-pricing-tables': {
    slug: 'divi-pricing-tables',
    h1: 'Divi Pricing Tables That Sell the Middle Column',
    metaTitle: 'Divi Pricing Tables — Free Divi 5 Pricing Sections',
    metaDescription:
      'Free Divi 5 pricing table sections: 2–4 column layouts, highlighted plans, feature lists and CTAs. Validated JSON you can import and restyle in minutes.',
    intro: `Pricing sections punish sloppy design more than any other part of a site: uneven column heights, feature lists that don't align, a "most popular" badge that looks like an afterthought — visitors read all of it as a signal about the product. The pricing tables in this collection are built to remove that risk. Columns align, feature rows share a rhythm, highlighted plans are visually promoted without shouting, and calls to action sit at a consistent height so comparison shopping feels effortless.

You'll find two-, three- and four-column arrangements, tables with and without toggle-style plan framing, minimal corporate treatments and bolder dark variants. Everything is native Divi 5 — real pricing and button modules, not images — and every section passed a deterministic structural validation before it was published, so the file you import behaves exactly like the screenshots. Mobile behavior is designed, not left to chance: columns stack in a deliberate order with spacing that keeps each plan scannable.

Import a pricing section into your existing page through the portability panel, then edit plan names, prices, and feature rows directly in the builder. Because the structure uses standard modules, hooking buttons to your checkout or signup flow is just setting link URLs.

Like all sections in the library, pricing tables are free downloads with an email, and the commercial license covers unlimited client sites. If you're building a complete offer page, pair a table with a testimonial section and an FAQ from the related categories below — objection handling belongs next to the price.`,
    filters: { type: ['pricing'] },
    faq: [
      {
        question: 'Are the prices and features editable?',
        answer:
          'Completely. Plans are built from standard Divi 5 modules, so names, prices, feature rows, badges and buttons are all edited directly in the builder like any other content.',
      },
      IMPORT_FAQ,
      LICENSE_FAQ,
    ],
    related: ['divi-sections', 'divi-layouts', 'divi-landing-pages'],
  },

  'divi-contact-page-templates': {
    slug: 'divi-contact-page-templates',
    h1: 'Divi Contact Page Templates & Sections',
    metaTitle: 'Divi Contact Page Templates — Free Divi 5 Contact Sections',
    metaDescription:
      'Divi 5 contact sections with working form modules, business info blocks and map-ready layouts. Free validated JSON downloads for any industry.',
    intro: `Contact pages are where interest becomes conversation, and they're routinely the least-designed page on a site. The contact templates in this collection treat the page as a conversion surface: a clear invitation instead of a bare form, business information arranged so it's scannable, trust cues where hesitation happens, and form fields kept to the minimum that your follow-up actually needs.

Every contact section here uses Divi 5's real form module — not a third-party embed, not a static mockup — so after import you connect your email address in the module settings and submissions work. Around the form you'll find the supporting structure that makes a contact page feel considered: split layouts pairing the form with office details or a photo, compact contact strips for landing pages, and fuller sections with hours, locations, and social links for service businesses. Styles range from minimal and corporate to warmer, more personal treatments that suit restaurants, coaches, and studios.

As with everything in the library, each section is generated natively for Divi 5 and passes deterministic validation before publication. The import is uneventful; the responsive behavior is already tuned; the fields, labels, and button text are all editable in the builder.

Contact sections are free downloads — email in, JSON out — with a commercial license for client work included. Pair one with a hero and an FAQ section from the related links below and you have the trust backbone of a service site in three imports.`,
    filters: { type: ['contact'] },
    faq: [
      {
        question: 'Do the contact forms actually work?',
        answer:
          'Yes — they are native Divi 5 form modules. After import you set the recipient email (and any spam protection) in the module settings, and submissions are delivered like any Divi form.',
      },
      IMPORT_FAQ,
      LICENSE_FAQ,
    ],
    related: ['divi-sections', 'divi-templates', 'divi-layouts'],
  },

  'divi-website-templates': {
    slug: 'divi-website-templates',
    h1: 'Divi Website Templates — Coherent Multi-Section Designs',
    metaTitle: 'Divi Website Templates — Divi 5 Site & Page Templates',
    metaDescription:
      'Divi 5 website templates: complete landing pages and themed packs with matching sections, palettes and typography. Validated JSON, commercial license.',
    intro: `The hard part of assembling a site from a template library isn't finding good sections — it's coherence. Ten attractive sections from ten different designers make one incoherent website. This collection solves that at two levels. Full landing pages give you an entire page designed as a single composition: one palette, one typography scale, one spacing system from hero to footer. Themed packs go further, bundling multiple pages built on a shared brand direction, so your homepage, services page, and contact page look like they were commissioned together — because, in effect, they were.

Every template is native Divi 5 and validated against the builder's real module schema before publication. Import a page and the full structure appears in your builder with responsive settings intact; import a pack and each page arrives as its own clean layout. From there it's content replacement, not reconstruction — swap headlines, imagery and offers while the design system holds.

Industries covered include SaaS, agencies, restaurants, real estate, fitness, coaching, e-commerce, nonprofits and events, in styles from minimal and corporate to elegant and dark. Real desktop and mobile screenshots on every template page show the complete scroll before you commit.

Single-page templates and multi-page themed packs both follow the library's standard free-download model — no paid tier, no subscription wall. All of it carries the same commercial license: unlimited sites, client work included. If you're migrating an existing site instead of building fresh, pair a template with our Elementor → Divi 5 converter plugin; if you're starting new, start here rather than with individual sections.`,
    filters: { type: ['full_landing'] },
    faq: [
      {
        question: 'What is the difference between a template and a pack?',
        answer:
          'A template here is one complete page in a single JSON file. A pack is a set of pages (and sometimes extra sections) designed on one shared brand direction, bundled together — free, like everything else in the catalog — so a whole site stays coherent.',
      },
      IMPORT_FAQ,
      LICENSE_FAQ,
      DIVI4_FAQ,
    ],
    related: ['divi-landing-pages', 'divi-homepage-layouts', 'divi-templates'],
  },

  'divi-homepage-layouts': {
    slug: 'divi-homepage-layouts',
    h1: 'Divi Homepage Layouts — First Impressions, Handled',
    metaTitle: 'Divi Homepage Layouts — Full Divi 5 Home Page Designs',
    metaDescription:
      'Complete Divi 5 homepage layouts: hero, services, proof, and CTA in one coherent import. Free validated downloads with real mobile screenshots.',
    intro: `Your homepage carries a heavier load than any other page: it has to explain the business, establish taste, and route three different kinds of visitors — buyers, browsers, and skeptics — toward the right next step. The homepage layouts in this collection are complete compositions built for that job. Each one sequences a full narrative: a hero that states the offer plainly, sections that unpack services or features, social proof placed where doubt naturally appears, and a closing call to action that doesn't rely on the visitor scrolling back up.

Every homepage arrives as one Divi 5 JSON file. Import it and the entire page lands in the builder — sections, responsive settings, spacing system, all of it — validated against Divi 5's real module schema before it was ever listed. The screenshots on each layout page show the complete desktop scroll and the mobile rendering, so you can judge the actual page rather than a cherry-picked hero crop.

Design directions span the practical range: minimal and corporate for consultancies and SaaS, warm and elegant for restaurants and studios, bold and dark for brands that lead with attitude. Industry-specific compositions — real estate, fitness, coaching, e-commerce, nonprofits, events — bake in the sections those businesses actually need.

Import, replace the copy and imagery, wire the buttons to your pages, and the hardest page on your site is done. If you need matching inner pages afterward, the themed packs and related categories below continue the same design systems.`,
    filters: { type: ['full_landing'] },
    faq: [
      {
        question: 'Can I set an imported layout as my homepage?',
        answer:
          'Yes. Import the JSON into a page, publish it, then set that page as your static front page in WordPress (Settings → Reading). The layout itself needs no special configuration.',
      },
      IMPORT_FAQ,
      LICENSE_FAQ,
    ],
    related: ['divi-landing-pages', 'divi-website-templates', 'divi-hero-sections'],
  },

  'elegant-themes-layouts': {
    slug: 'elegant-themes-layouts',
    h1: 'Layouts for Elegant Themes’ Divi 5 Builder',
    metaTitle: 'Elegant Themes Divi Layouts — Divi 5 Library Alternative',
    metaDescription:
      'A third-party layout library for Elegant Themes’ Divi 5: validated sections and landing pages beyond the built-in library, free to download.',
    intro: `Elegant Themes ships Divi with a built-in layout library, and it's a genuinely useful starting point — but it's the same starting point every other Divi site begins from. If you've ever recognized a competitor's homepage as "that Divi pack," you know the problem. This library exists as an independent, continuously growing alternative: layouts designed and generated specifically for Divi 5, published only after passing a deterministic validation against the builder's real module schema.

To be clear about the relationship: we're not affiliated with Elegant Themes. We build *for* their builder — every layout here is native Divi 5 JSON that imports through the standard portability panel, exactly like an export from the official library. What's different is the catalog: section-first organization (heroes, pricing, testimonials, features, FAQs, contact, galleries, footers), four-axis filtering by type, industry, style and color, full-scroll desktop and mobile screenshots for honest evaluation, and a pipeline that adds validated new designs continuously rather than in occasional pack drops.

The economics are different too. Every layout here is free — individual sections and curated multi-page packs alike. An email address gets you the JSON, with a commercial license covering unlimited client sites and no subscription wall anywhere in the catalog. The only thing we sell is the WordPress migration plugins — the Elementor → Divi 5 converter, for instance — for teams moving an existing site into this builder rather than starting fresh.

If Divi is your builder and the official library is starting to feel like a uniform, this is the second wardrobe. Browse the newest layouts below or jump into a category that matches today's project.`,
    filters: {},
    faq: [
      {
        question: 'Is this site affiliated with Elegant Themes?',
        answer:
          'No. Divi5Lab is an independent library that builds layouts for Divi 5, Elegant Themes’ builder. You still need your own Divi license from Elegant Themes to use the builder itself.',
      },
      IMPORT_FAQ,
      LICENSE_FAQ,
    ],
    related: ['divi-5-templates', 'divi-layouts', 'divi-templates'],
  },

  'free-divi-layouts': {
    slug: 'free-divi-layouts',
    h1: 'Free Divi Layouts — Download Validated Divi 5 Sections',
    metaTitle: 'Free Divi Layouts — Validated Divi 5 Downloads',
    metaDescription:
      'Genuinely free Divi layouts: validated Divi 5 sections for heroes, pricing, testimonials and more. Email in, JSON out — commercial license included.',
    intro: `"Free" in the page-builder world usually means one of three things: a teaser crippled until you subscribe, an abandoned pack from 2019 that half-imports, or a lead magnet so generic it wasn't worth the form. This page is the fourth kind. Every individual section in our library — heroes, pricing tables, testimonial walls, feature grids, FAQ accordions, contact sections, galleries, footers — is a genuinely free download: you trade an email address, you get the Divi 5 JSON file, permanently, with a commercial license that covers client work on unlimited sites.

The quality bar doesn't drop because the price is zero. Free sections come off the same pipeline as everything else: generated natively for Divi 5, checked by a deterministic validator against the builder's real module schema, screenshotted at desktop and mobile widths so you can see exactly what you're getting. If it's listed, it imports cleanly — that rule has no free-tier exception.

Curation at scale is free too: multi-page themed packs, where every page shares one brand direction, cost nothing more than the same email address. There's no subscription wall anywhere in the catalog. The only thing we actually sell is the WordPress migration plugins — the Elementor → Divi 5 converter, for one — for teams moving an existing site into Divi 5 rather than building fresh.

Start below with the newest free layouts, or narrow by section type, industry, or style. Import through Divi's portability panel, swap in your content, and ship. No watermark, no expiring license, no "pro version" of the same file.`,
    filters: {},
    freeOnly: true,
    faq: [
      {
        question: 'What is the catch with free downloads?',
        answer:
          'You provide an email address, which joins our list (unsubscribe anytime). The file itself is complete and permanently yours — no watermark, no expiry, no upsell inside the JSON.',
      },
      LICENSE_FAQ,
      IMPORT_FAQ,
      {
        question: 'Are any layouts in the catalog paid?',
        answer:
          'No — every layout is free, whether it is a single section or a multi-page themed pack. The only paid products on the site are our WordPress migration plugins (like the Elementor → Divi 5 converter), which are a separate thing entirely from the layout catalog.',
      },
    ],
    related: ['free-divi-templates', 'divi-layouts', 'divi-sections'],
  },

  'free-divi-templates': {
    slug: 'free-divi-templates',
    h1: 'Free Divi Templates for Divi 5',
    metaTitle: 'Free Divi Templates — Divi 5 JSON Downloads',
    metaDescription:
      'Free Divi templates built for Divi 5: sections and page designs you can import in seconds. Validated structure, real screenshots, commercial license.',
    intro: `Free Divi templates are easy to find and hard to trust. Files circulate in Facebook groups with no version information, blog roundups link to packs whose modules predate the current builder, and "free" download portals wrap a 2-megabyte JSON in three interstitial ads. This page is the boring, reliable alternative: a continuously growing set of templates built natively for Divi 5, each one validated against the builder's real module schema before publication, each one downloadable in exchange for nothing more than an email address.

The free tier here isn't a demo shelf. It includes the section templates that do most of the work on real sites — heroes, pricing tables, testimonials, feature grids, FAQs, contact sections with working form modules, galleries, and footers — across every industry and style axis in the catalog. Each template page shows full desktop and mobile screenshots taken from an actual rendered import, not builder mockups, so what you evaluate is what you get.

Import is standard Divi: portability panel, upload JSON, done. The commercial license included with every download covers unlimited sites, including client projects — the only prohibition is reselling or redistributing the files themselves.

When a project outgrows single templates, coherent multi-page packs continue the same design systems — still free, still just an email address, no subscription wall. There's no pressure baked into any of the files: they're complete, current, and yours. If you're migrating an existing Elementor site rather than building fresh, our Elementor → Divi 5 converter plugin is the tool for that job. Browse the newest templates below or filter to the section type you need today.`,
    filters: {},
    freeOnly: true,
    faq: [
      {
        question: 'Are free templates lower quality than premium tools?',
        answer:
          'No — every template comes off the same generation pipeline and passes the same deterministic validation, whether it is a single section or a multi-page pack. The only paid products on the site are the WordPress migration plugins, an entirely separate category from the layout catalog.',
      },
      IMPORT_FAQ,
      LICENSE_FAQ,
    ],
    related: ['free-divi-layouts', 'divi-templates', 'divi-5-templates'],
  },
};

export function getKeywordPage(slug: string): KeywordPage | undefined {
  return KEYWORD_PAGES[slug];
}

export function listKeywordPages(): KeywordPage[] {
  return Object.values(KEYWORD_PAGES);
}
