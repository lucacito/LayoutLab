import { db } from './client';
import { layouts, packs, packLayouts, tags, layoutTags } from './schema';
import { AXIS_VALUES } from '@/lib/catalog/filters';

type LayoutSeed = typeof layouts.$inferInsert;
type PackSeed = typeof packs.$inferInsert;
type TagSeed = typeof tags.$inferInsert;
type PackLayoutSeed = typeof packLayouts.$inferInsert;
type LayoutTagSeed = typeof layoutTags.$inferInsert;

function preview(slug: string, n: number): string[] {
  return [0, 1, 2].map((i) => `https://picsum.photos/seed/${slug}-${i}/1200/${900 + i}`).slice(0, n);
}

// A deterministic spread across the four axes so every filter has matches.
const COMBOS: { type: string; niche: string; style: string; colors: string[] }[] = [
  { type: 'hero', niche: 'saas', style: 'minimal', colors: ['blue', 'monochrome'] },
  { type: 'hero', niche: 'agency', style: 'bold', colors: ['purple'] },
  { type: 'pricing', niche: 'saas', style: 'dark', colors: ['blue'] },
  { type: 'pricing', niche: 'ecommerce', style: 'corporate', colors: ['green'] },
  { type: 'testimonials', niche: 'coaching', style: 'elegant', colors: ['pastel'] },
  { type: 'cta', niche: 'fitness', style: 'bold', colors: ['red', 'orange'] },
  { type: 'features', niche: 'saas', style: 'minimal', colors: ['blue'] },
  { type: 'faq', niche: 'nonprofit', style: 'minimal', colors: ['green'] },
  { type: 'footer', niche: 'agency', style: 'dark', colors: ['monochrome'] },
  { type: 'header', niche: 'restaurant', style: 'elegant', colors: ['orange'] },
  { type: 'contact', niche: 'real_estate', style: 'corporate', colors: ['blue'] },
  { type: 'gallery', niche: 'portfolio', style: 'playful', colors: ['purple', 'pastel'] },
  { type: 'full_landing', niche: 'saas', style: 'bold', colors: ['blue', 'purple'] },
  { type: 'full_landing', niche: 'events', style: 'playful', colors: ['orange'] },
];

const TITLE_CASE: Record<string, string> = {
  saas: 'SaaS', cta: 'CTA', faq: 'FAQ', real_estate: 'Real Estate',
  ecommerce: 'E-commerce', full_landing: 'Full Landing Page',
};
function label(v: string): string {
  return TITLE_CASE[v] ?? v.charAt(0).toUpperCase() + v.slice(1);
}

export function buildSeedData(): {
  tags: TagSeed[];
  layouts: LayoutSeed[];
  packs: PackSeed[];
  packLayouts: PackLayoutSeed[];
  layoutTags: LayoutTagSeed[];
} {
  // Tags across all four axes (used by Phase 6 landing pages).
  const tagRows: TagSeed[] = [];
  (['type', 'niche', 'style'] as const).forEach((axis) => {
    AXIS_VALUES[axis].forEach((slug) => {
      tagRows.push({ id: `tag_${axis}_${slug}`, axis, slug, title: label(slug) });
    });
  });
  AXIS_VALUES.color.forEach((slug) => {
    tagRows.push({ id: `tag_feature_${slug}`, axis: 'feature', slug, title: label(slug) });
  });

  const layoutRows: LayoutSeed[] = COMBOS.map((c, i) => {
    const slug = `${c.type}-${c.niche}-${c.style}-${i + 1}`;
    const title = `${label(c.style)} ${label(c.niche)} ${label(c.type)}`;
    const description = `A ${c.style} ${label(c.type)} section designed for ${label(c.niche)} sites. Validated Divi 5 layout, ready to import.`;
    return {
      id: `layout_${i + 1}`,
      slug,
      title,
      description,
      type: c.type,
      niche: c.niche,
      style: c.style,
      colors: c.colors,
      diviJsonBlobKey: `layouts/${slug}.json`,
      previewImageKeys: preview(slug, 3),
      contentHash: `seed-hash-${i + 1}`,
      validatorPassed: true,
      seo: {
        metaTitle: `${title} — Divi 5 Layout`,
        metaDescription: description,
        keywords: [c.type, c.niche, c.style, 'divi 5', 'layout'],
      },
      status: 'published',
      publishedAt: new Date('2026-06-01T00:00:00Z'),
    };
  });

  const packRows: PackSeed[] = [
    {
      id: 'pack_free_heroes', slug: 'free-hero-starter', title: 'Free Hero Starter',
      description: 'A free taste of the library: hero sections to drop into any Divi 5 site.',
      kind: 'free', priceCents: 0, coverImageKey: 'https://picsum.photos/seed/pack-free/1200/800',
      seo: { metaTitle: 'Free Hero Starter Pack', metaDescription: 'Free Divi 5 hero sections.' },
      status: 'published',
    },
    {
      id: 'pack_saas', slug: 'saas-conversion-kit', title: 'SaaS Conversion Kit',
      description: 'Pricing, features, CTAs and full landing pages tuned for SaaS conversions.',
      kind: 'paid', priceCents: 4900, coverImageKey: 'https://picsum.photos/seed/pack-saas/1200/800',
      seo: { metaTitle: 'SaaS Conversion Kit', metaDescription: 'Divi 5 layouts for SaaS.' },
      status: 'published',
    },
    {
      id: 'pack_agency', slug: 'agency-essentials', title: 'Agency Essentials',
      description: 'Bold hero, footer and gallery sections for agencies and portfolios.',
      kind: 'paid', priceCents: 3900, coverImageKey: 'https://picsum.photos/seed/pack-agency/1200/800',
      seo: { metaTitle: 'Agency Essentials', metaDescription: 'Divi 5 layouts for agencies.' },
      status: 'published',
    },
  ];

  // Assign layouts to packs by niche/type.
  const packLayoutRows: PackLayoutSeed[] = [];
  const pushPL = (packId: string, predicate: (l: LayoutSeed) => boolean) => {
    layoutRows.filter(predicate).forEach((l, pos) =>
      packLayoutRows.push({ packId, layoutId: l.id!, position: pos }));
  };
  pushPL('pack_free_heroes', (l) => l.type === 'hero');
  pushPL('pack_saas', (l) => l.niche === 'saas');
  pushPL('pack_agency', (l) => l.niche === 'agency' || l.niche === 'portfolio');

  // Tag each layout on its three primary axes.
  const layoutTagRows: LayoutTagSeed[] = [];
  layoutRows.forEach((l) => {
    layoutTagRows.push({ layoutId: l.id!, tagId: `tag_type_${l.type}` });
    if (l.niche) layoutTagRows.push({ layoutId: l.id!, tagId: `tag_niche_${l.niche}` });
    if (l.style) layoutTagRows.push({ layoutId: l.id!, tagId: `tag_style_${l.style}` });
  });

  return { tags: tagRows, layouts: layoutRows, packs: packRows, packLayouts: packLayoutRows, layoutTags: layoutTagRows };
}

async function main() {
  const data = buildSeedData();
  // Idempotent: upsert parents, then replace join rows.
  await db.insert(tags).values(data.tags).onConflictDoNothing();
  await db.insert(layouts).values(data.layouts).onConflictDoNothing();
  await db.insert(packs).values(data.packs).onConflictDoNothing();
  await db.insert(packLayouts).values(data.packLayouts).onConflictDoNothing();
  await db.insert(layoutTags).values(data.layoutTags).onConflictDoNothing();
  console.log(`Seeded ${data.layouts.length} layouts, ${data.packs.length} packs, ${data.tags.length} tags.`);
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
