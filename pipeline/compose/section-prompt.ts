import type { Brief } from './brief';
import { selectPalette, pickByRendezvous } from './palettes';
import type { Step } from './flow';

/** Where a section sits in the page, so we can coordinate the background rhythm
 *  (light → tinted → light → dark) across sections generated independently. */
export interface SectionContext {
  index?: number;
  total?: number;
  /** Style/niche of the parent Target — used to select a page-wide palette
   *  deterministically (via selectPalette) when the brief doesn't pin one. */
  style?: string;
  niche?: string;
}

/** One named, prompt-ready treatment for a role. `id` is the append-stability
 *  anchor for `pickByRendezvous` — never derive it from array position (same
 *  rationale as `StylePaletteVariant` in palettes.ts).
 *
 *  Selection is keyed by `treatmentKey` (style + niche) below — deliberately
 *  NOT by role, since each role's variant list is scored independently with
 *  its own ids; see `treatmentKey`'s doc comment for why reusing one key
 *  across every role's selection is safe. */
export interface RoleTreatment {
  id: string;
  text: string;
}

// Per-ROLE design direction — the missing ingredient that made composed pages
// plain: each section was generated blind, with only generic "make it nice"
// guidance. These give every role 2-3 concrete, premium Divi-5 treatments
// (e.g. hero: split / centered full-bleed / offset-image) so two pages of the
// same section type don't read as the same template re-skinned. Keep every
// treatment expressible with the recipe/decoration shapes the grounding
// already teaches; never invent attributes.
export const ROLE_DESIGN: Record<string, RoleTreatment[]> = {
  hero: [
    {
      id: 'hero-split',
      text: 'Design: a bold TWO-COLUMN hero — copy on one side (small eyebrow label, a large tight headline, a one-line subhead, and BOTH a primary and a lighter secondary button), a large relevant photo panel on the other (rounded corners, or a full-bleed image with a soft overlay so text stays legible). Optionally add a slim row of 3 short proof stats (e.g. a number + one-word label) beneath the buttons. Generous padding, spacious and confident.',
    },
    {
      id: 'hero-centered-fullbleed',
      text: 'Design: a CENTERED full-bleed hero — a large relevant photo (or gradient) fills the entire section as the background, with a soft dark overlay so text stays legible; centered on top: a small eyebrow label, a large tight headline, a one-line subhead, and a primary + secondary button. Optionally a slim row of 3 short proof stats beneath. Generous vertical padding, confident and cinematic.',
    },
    {
      id: 'hero-offset-image',
      text: 'Design: an OFFSET-IMAGE hero — copy occupies roughly 60% of the width (small eyebrow label, large tight headline, one-line subhead, primary + secondary buttons), while a smaller relevant photo panel sits offset to one side with a rounded-corner frame, feeling deliberately asymmetric rather than a strict 50/50 split. Optionally a slim row of 3 short proof stats beneath the buttons. Airy, editorial feel.',
    },
  ],
  trust: [
    {
      id: 'trust-strip',
      text: 'Design: a SLIM full-width trust strip (not a tall section) — a single row of 3–4 short credibility points or headline stats, each a small left-aligned icon (divi/blurb, icon left) + a bold value + a short label. Tinted or thin-bordered background, minimal padding. No big headline.',
    },
    {
      id: 'trust-logo-row',
      text: 'Design: a plain LOGO/BADGE row — 3–5 small trust badges, certifications, or partner mentions in a single centered row, muted icons, generous horizontal spacing, minimal or no background tint. No headline, no supporting copy — pure credibility signal.',
    },
  ],
  problem: [
    {
      id: 'problem-icon-row',
      text: 'Design: name 3 sharp pains as an icon-features row — a small icon + a short bold line each, evenly spaced. Plain (no cards), no pitch yet.',
    },
    {
      id: 'problem-callout',
      text: 'Design: a single large CALLOUT — one bold, empathetic sentence naming the visitor\'s core pain, centered, oversized type, on a plain background with generous whitespace and a subtle accent underline or quotation mark. No cards, no icons — let the words carry it.',
    },
  ],
  solution: [
    {
      id: 'solution-split',
      text: 'Design: a split image-and-text section — a relevant photo on one side, the mechanism explained on the other (short heading + 2–3 tight lines). Alternate which side the image sits on versus the hero.',
    },
    {
      id: 'solution-before-after',
      text: 'Design: a BEFORE/AFTER two-column comparison — a muted "old way" column (short list, dimmed) beside a bright "new way" column (short list, accent-highlighted), a small divider between them. No photo needed; let the contrast sell the mechanism.',
    },
  ],
  features: [
    {
      id: 'features-split',
      text: 'Design: a split image-and-text (or 3-up icon-features) detailing what it does and why it matters — real icons, tight copy, comfortable whitespace.',
    },
    {
      id: 'features-icon-grid',
      text: 'Design: a 2x2 or 3-up ICON-FEATURE GRID — no cards, no borders, just a small icon + bold short heading + one line per feature, evenly spaced with generous whitespace between items.',
    },
  ],
  why: [
    {
      id: 'why-split',
      text: 'Design: a split image-and-text section selling reassurance/outcomes — a relevant photo on one side, a short bold benefit heading + supporting line on the other. Calm, credible.',
    },
    {
      id: 'why-icon-row',
      text: 'Design: a 3-up icon-features row selling reassurance/outcomes — small icons, a short bold benefit heading each, one supporting line. Calm, credible, no photo needed.',
    },
  ],
  benefits: [
    {
      id: 'benefits-image-cards',
      text: 'Design: 3–4 BLURB IMAGE-CARDS in equal flex columns — each column IS the card: white (or tinted on dark) background, rounded corners (~16px), ~30px padding, a soft box shadow, and a hover lift (transform translateY ~-6px + deeper shadow, smooth transition). Put a REAL relevant photo at the top of each card (a divi/blurb image), then a short heading + 1–2 specific lines.',
    },
    {
      id: 'benefits-numbered-list',
      text: 'Design: a clean NUMBERED benefits list (no cards, no photos) — each benefit is a row with a bold number or check icon on the left, a short bold outcome heading + one supporting line to the right. Thin divider lines between rows, generous vertical rhythm.',
    },
  ],
  services: [
    {
      id: 'services-image-cards',
      text: 'Design: 3–4 BLURB IMAGE-CARDS in equal flex columns — each column IS the card: white (or tinted on dark) background, rounded corners (~16px), ~30px padding, a soft box shadow, and a hover lift (translateY ~-6px + deeper shadow, smooth transition). Each card leads with a REAL relevant photo (divi/blurb image at top), then the item name and a plain-language one-liner. Optionally highlight ONE card with the accent (tinted background or accent border).',
    },
    {
      id: 'services-icon-tabs',
      text: 'Design: a flatter ICON-LABEL row of services — a small icon + service name across the top for each, with a one-line description beneath each; no cards or photos, better suited to a longer service list than the card treatment.',
    },
  ],
  how_it_works: [
    {
      id: 'how_it_works-numbered-badges',
      text: 'Design: 3–4 NUMBERED steps in a row — each step opens with a filled CIRCULAR badge (border.radius 50%, accent background, contrasting bold number 1,2,3,4), then a short step heading + one line. Even spacing, generous padding; make the process feel effortless.',
    },
    {
      id: 'how_it_works-timeline',
      text: 'Design: a TIMELINE of 3–4 stops — a thin connecting line/divider with each stop marked by a small accent dot or badge carrying the step number, a short heading and one line next to it. Feels sequential and guided rather than a row of equal boxes.',
    },
  ],
  gallery: [
    {
      id: 'gallery-grid',
      text: 'Design: a clean 2–3 column image grid/gallery of real, relevant photos with a consistent corner radius and small gaps. Bright and reassuring; let the images carry the section.',
    },
    {
      id: 'gallery-featured-mosaic',
      text: 'Design: a FEATURED-PHOTO mosaic — build it from real rows with an ASYMMETRIC column split (e.g. a wide column for one large photo beside a narrower column stacking 2 smaller photos), then repeat with the split reversed for a second row, using real photos (divi/image) in each column rather than a single uniform gallery grid. Shared corner radius and small consistent gaps. Bright and reassuring; let the images carry the section, at varied sizes without a strict grid.',
    },
  ],
  social_proof: [
    {
      id: 'social_proof-cards',
      text: 'Design: 2–3 testimonial CARDS — each a rounded, padded card (soft shadow) with a small round avatar, an italic quote, and a name + role beneath. Sit them on a tinted background for contrast.',
    },
    {
      id: 'social_proof-featured-quote',
      text: 'Design: one FEATURED testimonial — an oversized italic quote with a round avatar and name + role, centered on a tinted background — plus 2 smaller supporting quotes beneath in a plain row (avatar + short quote, no cards).',
    },
  ],
  faq: [
    {
      id: 'faq-accordion',
      text: 'Design: an ACCORDION of 4–6 question/answer toggles (divi/accordion or a stack of divi/toggle) — collapsed by default, an open/closed +/− (or chevron) icon in the accent color, thin divider borders between items, comfortable padding. On wide screens the toggles may split into two columns.',
    },
    {
      id: 'faq-two-column-list',
      text: 'Design: a TWO-COLUMN plain Q&A list (no accordion, no toggle, everything visible at once) — 4–6 questions split evenly across two columns, each a bold question line directly followed by its answer beneath in body text, divided by thin borders.',
    },
  ],
  referral: [
    {
      id: 'referral-split',
      text: 'Design: a visually DISTINCT split section for a secondary audience (e.g. referring physicians) — set it on a tinted or dark panel. Copy + a compact numbered "streamlined process" list (01 / 02 / 03, each a small accent badge + a short line) on one side; a highlighted contact/CTA card (rounded, bordered, a phone/email line, a secondary button) on the other.',
    },
    {
      id: 'referral-tinted-banner',
      text: 'Design: a full-width TINTED BANNER for the secondary audience — a short headline calling them out by name, a compact INLINE 3-step process (01/02/03 as small inline badges, not stacked), and a single contact button; flatter and more compact than a two-column split.',
    },
  ],
  pricing: [
    {
      id: 'pricing-cards',
      text: 'Design: 2–3 plan columns as cards, the MIDDLE plan highlighted (slightly scaled or an accent border + deeper shadow + a small "Most popular" tag), each with a price, a feature checklist (small check icons), and one button. Equal full-width columns.',
    },
    {
      id: 'pricing-aligned-comparison',
      text: 'Design: 2–3 plan CARDS aligned for at-a-glance comparison — every card lists the SAME short feature labels in the SAME order (a check icon or short dash marks whether that plan includes it) so features line up row-by-row as you scan across cards; the recommended plan\'s card is visually distinguished with an accent border/background and a small "Recommended" tag, price + one button on every card.',
    },
  ],
  final_cta: [
    {
      id: 'final_cta-banner',
      text: 'Design: a full-width CTA BANNER — an accent or dark background, centered large headline + one supporting line, generous padding, and the primary button (optionally 2–3 buttons: the main action plus 1–2 lighter secondary links). This is the closer; make it striking.',
    },
    {
      id: 'final_cta-split',
      text: 'Design: a SPLIT final CTA — a short compelling headline + supporting line and the primary button on one side, a relevant photo or bold color panel on the other; still on the accent or dark background from the palette, still the closer.',
    },
  ],
};

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
