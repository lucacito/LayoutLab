// pipeline/theme.ts — coherent multi-page "theme" generator.
//
// The matrix pipeline (run.ts) generates independent layouts. A THEME is different:
// N full pages that must share ONE brand — same name, accent, voice, CTA and contact
// details — so they read as a single premium website (e.g. the Blackline agency pack).
//
// This reuses composeLanding with a *pinned* brief + brandFacts (the cohesion source,
// see pipeline/compose/index.ts) and runs each page through the same downstream steps
// as run.ts: validate gate → image resolve → mobile stack → dedupe → SEO → upload →
// render → ingest. Page slugs are deterministic (brand + role) so a companion pack
// script can link the pages by slug, idempotently.
import type { Guide } from './recipes';
import type { LlmClient } from './llm';
import type { ValidationResult } from './validate';
import type { UploadResult } from './upload';
import type { IngestPayload } from '@/lib/ingest/schema';
import { composeLanding, type Brief, type Step } from './compose';
import { generateSeo, slugify } from './seo';
import { contentHash } from './dedupe';
import { stackLayoutJsonMobile } from './stack-mobile';

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

export interface ThemeDeps {
  llm: LlmClient;
  guide: Guide;
  /** True if a page with this slug is already in the catalog — lets a run resume
   * across usage windows by skipping pages already generated (only the missing
   * pages cost generation). */
  pageExists?: (slug: string) => Promise<boolean>;
  validate: (json: string) => Promise<ValidationResult>;
  resolveImages?: (json: string) => Promise<string>;
  isDuplicate: (hash: string) => Promise<boolean>;
  upload: (hash: string, json: string) => Promise<UploadResult>;
  render?: (input: { title: string; postContent: string; hash: string }) => Promise<{ previewImageKeys: string[]; perceptualHash?: string }>;
  ingest: (payload: IngestPayload) => Promise<{ deduped: boolean }>;
  maxRepairs: number;
  maxParseRetries?: number;
  maxBudgetUsd?: number;
  log?: (msg: string) => void;
}

export interface ThemeResult {
  pageSlugs: string[];
  generated: number;
  ingested: number;
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

export async function runThemePack(spec: ThemeSpec, deps: ThemeDeps): Promise<ThemeResult> {
  const log = deps.log ?? (() => {});
  const result: ThemeResult = { pageSlugs: [], generated: 0, ingested: 0, dropped: 0, deduped: 0 };

  for (const page of spec.pages) {
    const label = `${spec.niche}/${page.role}`;
    const pageSlug = themePageSlug(spec.brief, spec, page);
    try {
      // 0. Resume: if this page already exists, don't regenerate it — just keep it
      //    in the pack. This is what makes a run survive a usage-limit interruption.
      if (deps.pageExists && (await deps.pageExists(pageSlug))) {
        result.pageSlugs.push(pageSlug);
        log(`skip existing ${pageSlug}`);
        continue;
      }

      // 1. Compose the page from the PINNED brief (cohesion). composeLanding validates
      //    + repairs each section, so the assembled document is valid by construction.
      let json = (
        await composeLanding(
          { type: 'full_landing', niche: spec.niche, style: spec.style, color: spec.color },
          {
            llm: deps.llm,
            guide: deps.guide,
            validate: deps.validate,
            maxRepairs: deps.maxRepairs,
            maxParseRetries: deps.maxParseRetries,
            maxBudgetUsd: deps.maxBudgetUsd,
            brief: spec.brief,
            brandFacts: spec.brandFacts,
            flow: page.flow,
            log,
          },
        )
      ).json;
      result.generated++;

      // 2. Final validation gate (composed docs are valid by construction; no whole-doc repair).
      const verdict = await deps.validate(json);
      if (!verdict.valid) {
        result.dropped++;
        log(`drop ${label}: ${verdict.violations.map((v) => v.code).join(',')}`);
        continue;
      }

      // 3. Real stock images (URL-for-URL; structure unchanged), then phone stacking.
      if (deps.resolveImages) json = await deps.resolveImages(json);
      json = stackLayoutJsonMobile(json);

      // 4. Dedupe by content hash (idempotent re-runs skip identical pages).
      const hash = contentHash(json);
      if (await deps.isDuplicate(hash)) {
        result.deduped++;
        log(`dedupe ${label} ${hash.slice(0, 12)}`);
        // Still record the slug: an already-ingested identical page is part of the pack.
        result.pageSlugs.push(pageSlug);
        continue;
      }

      // 5. SEO metadata/keywords/axes; slug + title pinned to brand+role for coherence.
      const seoTarget = { type: 'full_landing', niche: spec.niche, style: spec.style, color: spec.color };
      const seo = await generateSeo(json, seoTarget, { llm: deps.llm, maxBudgetUsd: deps.maxBudgetUsd });
      const slug = pageSlug;
      const title = themePageTitle(spec.brief, spec, page);

      // 6. Upload JSON (+ placeholder previews), then real screenshots (best-effort).
      // TODO(T4.2): unlike run.ts's ok/blank/failed render gate (T2.1), this path has
      // NO gate at all — on a render miss (blank, failed, or no `deps.render`) it just
      // keeps `placeholderPreviews` and ingests unconditionally; it never drops. Must
      // be unified with run.ts's render gates in T4.2.
      const { diviJsonBlobKey, previewImageKeys: placeholderPreviews } = await deps.upload(hash, json);
      let previewImageKeys = placeholderPreviews;
      let perceptualHash: string | undefined;
      if (deps.render) {
        const parsed = JSON.parse(json) as { post_title?: string; post_content?: string };
        if (parsed.post_content) {
          const r = await deps.render({ title, postContent: parsed.post_content, hash });
          if (r.previewImageKeys.length) previewImageKeys = r.previewImageKeys;
          perceptualHash = r.perceptualHash;
        }
      }

      const payload: IngestPayload = {
        slug,
        title,
        description: seo.metaDescription,
        type: 'full_landing',
        niche: spec.niche,
        style: spec.style,
        colors: spec.color ? [spec.color, ...seo.axes.colors.filter((c) => c !== spec.color)] : seo.axes.colors,
        diviJsonBlobKey,
        previewImageKeys,
        contentHash: hash,
        perceptualHash,
        validatorPassed: true,
        seo: { metaTitle: seo.title, metaDescription: seo.metaDescription, keywords: seo.keywords },
        tags: [
          { axis: 'type', slug: 'full_landing' },
          { axis: 'niche', slug: spec.niche },
          { axis: 'style', slug: spec.style },
        ],
      };
      await deps.ingest(payload);
      result.ingested++;
      result.pageSlugs.push(slug);
      log(`ingested ${slug}`);
    } catch (err) {
      result.dropped++;
      log(`error on ${label}: ${(err as Error).message}`);
    }
  }

  return result;
}
