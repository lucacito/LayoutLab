import type { Brief } from './brief';
import { selectPalette, pickByRendezvous } from './palettes';
import type { Step } from './flow';
import { SECTION_TYPES, buildUniqueRecord, type RoleTreatment } from '@/pipeline/recipes/section-types';

export type { RoleTreatment } from '@/pipeline/recipes/section-types';

/** Where a section sits in the page, so we can coordinate the background rhythm
 *  (light → tinted → light → dark) across sections generated independently. */
export interface SectionContext {
  index?: number;
  total?: number;
  /** Style/niche of the parent Target — used to select a page-wide palette
   *  deterministically (via selectPalette) when the brief doesn't pin one. */
  style?: string;
  niche?: string;
  /** T3.3 — the validator's LandingGuide blueprint sentence for this landing's
   *  resolved business-type category (see `landingBlueprintForCategory` in
   *  flow.ts), echoed to every section as strategic context for WHY this spine
   *  works for this kind of business. Optional: undefined when the guide
   *  wasn't loaded or has no entry for the category — omitted from the prompt
   *  in that case (fail-soft; doesn't change the deterministic flow itself). */
  landingBlueprint?: string;
}

// Per-ROLE design direction — the missing ingredient that made composed pages
// plain: each section was generated blind, with only generic "make it nice"
// guidance. These give every role 2-3 concrete, premium Divi-5 treatments
// (e.g. hero: split / centered full-bleed / offset-image) so two pages of the
// same section type don't read as the same template re-skinned. Keep every
// treatment expressible with the recipe/decoration shapes the grounding
// already teaches; never invent attributes.
//
// T4.3: derived from the SECTION_TYPES registry (pipeline/recipes/section-types.ts)
// — was a hand-maintained literal keyed directly by role. The registry nests each
// role's variants under whichever TYPE that role generates as (a type can host
// several roles — see section-types.ts's module comment for why); this flattens
// it back to the original flat role -> variants shape so every existing call
// site (pickRoleTreatment below, tests) is unchanged. Selection is keyed by
// `treatmentKey` (style + niche) below — deliberately NOT by role, since each
// role's variant list is scored independently with its own ids; see
// `treatmentKey`'s doc comment for why reusing one key across every role's
// selection is safe.
//
// Uses buildUniqueRecord (not Object.fromEntries) so a duplicate role key
// declared under two different SECTION_TYPES entries throws at module-init
// time instead of silently letting the later entry's variants win — see
// buildUniqueRecord's doc comment in section-types.ts.
export const ROLE_DESIGN: Record<string, RoleTreatment[]> = buildUniqueRecord(
  Object.values(SECTION_TYPES).flatMap((entry) => Object.entries(entry.roles ?? {})),
  'ROLE_DESIGN (pipeline/compose/section-prompt.ts)',
);

/** Same key shape as `paletteKey` in palettes.ts (style + niche) — treatment
 *  variety should track the same "what makes two landings look different"
 *  signal the palette already uses. Role is NOT part of the key: each role's
 *  variant list is scored independently (via its own variant ids), so reusing
 *  the same (style, niche) key across every role is safe and keeps selection
 *  simple — see the append-stability rationale on `pickByRendezvous`. */
function treatmentKey(ctx: { style?: string; niche?: string }): string {
  return `${ctx.style ?? ''}|${ctx.niche ?? ''}`;
}

function pickRoleTreatment(role: string, ctx: { style?: string; niche?: string }): RoleTreatment | undefined {
  const variants = ROLE_DESIGN[role];
  if (!variants || variants.length === 0) return undefined;
  return pickByRendezvous(treatmentKey(ctx), variants);
}

/** Returns the stable `id` of the treatment variant that would be selected for
 *  this (role, style, niche) — exists for tests, mirroring
 *  `selectPaletteVariantId` in palettes.ts. */
export function selectRoleTreatmentId(role: string, ctx: { style?: string; niche?: string } = {}): string | undefined {
  return pickRoleTreatment(role, ctx)?.id;
}

// Alternating background rhythm so independently-generated sections read as one
// page: light → tinted → light → tinted, with the closing CTA always bold.
function backgroundTone(role: string, index?: number): string {
  if (role === 'final_cta') return 'Sit this section on the accent (or the dark) background from the palette for a strong close.';
  if (role === 'hero') return 'The hero owns its own treatment (image/overlay or a light background) — set the visual rhythm the rest of the page follows.';
  if (typeof index !== 'number') return '';
  return index % 2 === 0
    ? 'Background: a clean WHITE/near-white background for this section.'
    : `Background: a soft TINTED panel background (the palette tint) for this section — this alternation gives the page visual rhythm.`;
}

// Composition text placed into a synthesized section Target's `layout`, so
// buildGenerationPrompt grounds the section on its recipe while every section
// shares the same brand (name, accent, CTA, voice) AND the same design system
// (palette, per-role treatment, background rhythm) — the cohesion mechanism.
export function buildSectionRolePrompt(step: Step, brief: Brief, ctx: SectionContext = {}): string {
  const palette = brief.palette ?? selectPalette({ style: ctx.style, niche: ctx.niche }, brief.accentColorHex);
  const lines = [
    `This section is part of ONE cohesive landing page for "${brief.businessName}" (${brief.businessType}).`,
    `Audience: ${brief.audience}. Voice: ${brief.voice}.`,
    `Shared design system — use these EXACT colors across the WHOLE page for one consistent look: ` +
      `primary/accent ${palette.primary} (buttons, icons, links, highlights), secondary ${palette.secondary}, ` +
      `soft tint ${palette.tint} (alternating section panels), dark ${palette.dark} (dark panels/footer), ` +
      `heading text ${palette.heading}, body text ${palette.body}. ` +
      `On the dark background (${palette.dark}) used for final_cta/footer panels, do NOT use the ` +
      `heading/body colors above (they are for the light/tinted panels and are illegible on dark) — ` +
      `instead use the tint color ${palette.tint} for all heading and body text on that dark panel. ` +
      `Reuse ONE corner-radius and ONE soft box-shadow for every card so the page feels systematic.`,
  ];
  if (brief.designNotes) lines.push(`Art direction: ${brief.designNotes}.`);
  if (ctx.landingBlueprint) {
    lines.push(`Strategic blueprint for this business type (validator's conversion guide): ${ctx.landingBlueprint}`);
  }
  const roleDesign = pickRoleTreatment(step.role, { style: ctx.style, niche: ctx.niche });
  if (roleDesign) lines.push(roleDesign.text);
  const tone = backgroundTone(step.role, ctx.index);
  if (tone) lines.push(tone);
  lines.push(`Section role: ${step.job}`);
  lines.push('Write specific, benefit-led copy in second person; no lorem ipsum; bracket any placeholder facts like "[Replace: client name]".');
  if (step.cta) {
    lines.push(`Include the primary CTA button labelled exactly "${brief.primaryCta}" (the one action for the whole page).`);
  } else {
    lines.push('Do not add a competing call-to-action button in this section.');
  }
  return lines.join(' ');
}
