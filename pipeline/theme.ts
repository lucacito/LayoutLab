// pipeline/theme.ts — coherent multi-page "theme" generator.
//
// The matrix pipeline (run.ts) generates independent layouts. A THEME is different:
// N full pages that must share ONE brand — same name, accent, voice, CTA and contact
// details — so they read as a single premium website (e.g. the Blackline agency pack).
//
// T4.2: this is now a THIN CONFIG over run.ts's shared `processItem` gate pipeline —
// the former duplicate orchestrator (its own copy of validate→images→stack→dedupe→
// seo→upload→render→ingest, with none of the Tier 1–2 gates) is gone. Each page
// becomes a `PipelineItem` whose `composeExtras` pins the shared brief/brandFacts/
// flow (the cohesion source — see pipeline/compose/index.ts) and whose `pins` fix
// the deterministic brand+role slug/title and the pack's axes so the SEO step can't
// drift them per page. Every gate in `processItem` — render ok/blank/failed,
// perceptual near-dupe, vision critic, SEO quality floor, error classification with
// usage-limit/auth run-abort, transient-infra retry — now applies to theme runs
// automatically, and any gate added there in the future will too.
//
// Two theme-specific policies live here (documented adjudications, not gaps):
// - Render-miss is a DROP. Pre-T4.2 this path ingested pages with placeholder
//   previews on a render miss (the TODO(T4.2) hole); now the shared render gate
//   drops them like any other layout — a paid theme page with no real screenshot
//   is not sellable.
// - Near-dupe is checked against the EXISTING catalog only, never within the pack:
//   `growNearDupPool: false` keeps sibling pages (intentionally same palette, shared
//   header/footer bands) from near-dupe-dropping each other, while a page that
//   near-duplicates an already-published layout still drops.
import type { RunDeps, PipelineItem } from './run';
import { createRunContext, processItem } from './run';
import type { Brief, Step } from './compose';
import { slugify } from './seo';

export interface ThemePage {
  /** Machine role, used in the slug: 'home' | 'menu' | 'about' | … */
  role: string;
  /** Human label used in the title: 'Home', 'Menu', 'About'. */
  roleLabel: string;
  /** Persuasion spine for this page (groundable section types only). */
  flow: Step[];
}

export interface ThemeSpec {
  niche: string;
  style: string;
  color?: string;
  /** Pinned brand identity — shared verbatim across every page. */
  brief: Brief;
  /** Canonical contact facts appended to every section prompt. */
  brandFacts: string;
  /** Ordered pages; page[0] is the home page (its cover becomes the pack cover). */
  pages: ThemePage[];
}

/**
 * T4.2: the full `RunDeps` surface minus `targets` (pages come from the spec),
 * plus theme-only `pageExists` resume support. Because this is derived from
 * `RunDeps`, every gate dep run.ts grows (nearDuplicateHashes, visionCritic,
 * onEvent, retry knobs, …) is immediately available to theme runs too — the
 * exact "a gate added in one place applies to both" acceptance criterion.
 */
export interface ThemeDeps extends Omit<RunDeps, 'targets'> {
  /** True if a page with this slug is already in the catalog — lets a run resume
   * across usage windows by skipping pages already generated (only the missing
   * pages cost generation). */
  pageExists?: (slug: string) => Promise<boolean>;
}

export interface ThemeResult {
  pageSlugs: string[];
  generated: number;
  ingested: number;
  /** Every non-ingested, non-exact-dedupe terminal fate: quality drops
   * (validation/content/vision-critic), render misses/blanks, near-dupes
   * against the existing catalog, and infra errors. Kept as ONE bucket for
   * back-compat with the theme scripts' summary logging; the full breakdown
   * is visible via `deps.log`/`deps.onEvent` (the shared RunEvent feed). */
  dropped: number;
  deduped: number;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Deterministic, collision-resistant slug so pack assembly can find each page. */
export function themePageSlug(brief: Brief, spec: ThemeSpec, page: ThemePage): string {
  return slugify(`${brief.businessName} ${spec.style} ${spec.niche} ${page.role} page for divi 5`);
}

export function themePageTitle(brief: Brief, spec: ThemeSpec, page: ThemePage): string {
  return `${brief.businessName} — ${cap(spec.style)} ${cap(spec.niche)} ${page.roleLabel} Page for Divi 5`;
}

/** Build the shared-orchestrator work item for one theme page: a full_landing
 * target with the pack's pinned brief/flow (composeExtras) and its deterministic
 * brand+role slug/title + fixed axes (pins). */
export function themePageItem(spec: ThemeSpec, page: ThemePage): PipelineItem {
  return {
    target: { type: 'full_landing', niche: spec.niche, style: spec.style, color: spec.color },
    composeExtras: { brief: spec.brief, brandFacts: spec.brandFacts, flow: page.flow },
    pins: {
      slug: themePageSlug(spec.brief, spec, page),
      title: themePageTitle(spec.brief, spec, page),
      type: 'full_landing',
      niche: spec.niche,
      style: spec.style,
      color: spec.color,
    },
  };
}

export async function runThemePack(spec: ThemeSpec, deps: ThemeDeps): Promise<ThemeResult> {
  const log = deps.log ?? (() => {});
  const result: ThemeResult = { pageSlugs: [], generated: 0, ingested: 0, dropped: 0, deduped: 0 };

  const runDeps: RunDeps = { ...deps, targets: [] }; // targets unused — the page loop below drives the run
  // Theme near-dupe adjudication (see module doc): check against the existing
  // catalog, never against this pack's own sibling pages.
  const ctx = await createRunContext(runDeps, { growNearDupPool: false });

  for (const page of spec.pages) {
    const pageSlug = themePageSlug(spec.brief, spec, page);

    // Resume: if this page already exists, don't regenerate it — just keep it in
    // the pack. This is what makes a run survive a usage-limit interruption.
    if (deps.pageExists && (await deps.pageExists(pageSlug))) {
      result.pageSlugs.push(pageSlug);
      log(`skip existing ${pageSlug}`);
      continue;
    }

    const { outcome, slug, abort } = await processItem(themePageItem(spec, page), ctx);

    switch (outcome) {
      case 'ingested':
        result.ingested++;
        result.pageSlugs.push(slug ?? pageSlug);
        break;
      case 'deduped':
        result.deduped++;
        // Still record the slug: an already-ingested identical page is part of the pack.
        result.pageSlugs.push(pageSlug);
        break;
      default:
        // dropped | near_duplicate | render_failed | render_blank | errored —
        // one back-compat bucket; the per-fate breakdown lives in the shared
        // summary counters and the RunEvent feed.
        result.dropped++;
        break;
    }

    if (abort) {
      log(`aborting remaining theme page(s) after ${page.role}`);
      break;
    }
  }

  // Mirrors the shared summary's meaning: pages that produced a composed
  // document (whether or not a later gate dropped them). Skipped (pageExists)
  // pages never generate, so this stays comparable to pre-T4.2.
  result.generated = ctx.summary.generated;
  return result;
}
