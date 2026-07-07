import type { Brief } from './brief';
import { selectPalette } from './palettes';
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

// Per-ROLE design direction — the missing ingredient that made composed pages
// plain: each section was generated blind, with only generic "make it nice"
// guidance. These give every role a concrete, premium Divi-5 treatment (split
// heroes, blurb image-cards, numbered process badges, FAQ accordions, CTA
// banners) — the structural richness a hand-built page has. Keep every treatment
// expressible with the recipe/decoration shapes the grounding already teaches;
// never invent attributes.
const ROLE_DESIGN: Record<string, string> = {
  hero:
    'Design: a bold TWO-COLUMN hero — copy on one side (small eyebrow label, a large tight headline, a one-line subhead, and BOTH a primary and a lighter secondary button), a large relevant photo panel on the other (rounded corners, or a full-bleed image with a soft overlay so text stays legible). Optionally add a slim row of 3 short proof stats (e.g. a number + one-word label) beneath the buttons. Generous padding, spacious and confident.',
  trust:
    'Design: a SLIM full-width trust strip (not a tall section) — a single row of 3–4 short credibility points or headline stats, each a small left-aligned icon (divi/blurb, icon left) + a bold value + a short label. Tinted or thin-bordered background, minimal padding. No big headline.',
  problem:
    'Design: name 3 sharp pains as an icon-features row — a small icon + a short bold line each, evenly spaced. Plain (no cards), no pitch yet.',
  solution:
    'Design: a split image-and-text section — a relevant photo on one side, the mechanism explained on the other (short heading + 2–3 tight lines). Alternate which side the image sits on versus the hero.',
  features:
    'Design: a split image-and-text (or 3-up icon-features) detailing what it does and why it matters — real icons, tight copy, comfortable whitespace.',
  why:
    'Design: a split image-and-text OR a 3-up icon-features row selling reassurance/outcomes — small icons, a short bold benefit heading each, one supporting line. Calm, credible.',
  benefits:
    'Design: 3–4 BLURB IMAGE-CARDS in equal flex columns — each column IS the card: white (or tinted on dark) background, rounded corners (~16px), ~30px padding, a soft box shadow, and a hover lift (transform translateY ~-6px + deeper shadow, smooth transition). Put a REAL relevant photo at the top of each card (a divi/blurb image), then a short heading + 1–2 specific lines.',
  services:
    'Design: 3–4 BLURB IMAGE-CARDS in equal flex columns — each column IS the card: white (or tinted on dark) background, rounded corners (~16px), ~30px padding, a soft box shadow, and a hover lift (translateY ~-6px + deeper shadow, smooth transition). Each card leads with a REAL relevant photo (divi/blurb image at top), then the item name and a plain-language one-liner. Optionally highlight ONE card with the accent (tinted background or accent border).',
  how_it_works:
    'Design: 3–4 NUMBERED steps in a row — each step opens with a filled CIRCULAR badge (border.radius 50%, accent background, contrasting bold number 1,2,3,4), then a short step heading + one line. Even spacing, generous padding; make the process feel effortless.',
  gallery:
    'Design: a clean 2–3 column image grid/gallery of real, relevant photos with a consistent corner radius and small gaps. Bright and reassuring; let the images carry the section.',
  social_proof:
    'Design: 2–3 testimonial CARDS — each a rounded, padded card (soft shadow) with a small round avatar, an italic quote, and a name + role beneath. Sit them on a tinted background for contrast.',
  faq:
    'Design: an ACCORDION of 4–6 question/answer toggles (divi/accordion or a stack of divi/toggle) — collapsed by default, an open/closed +/− (or chevron) icon in the accent color, thin divider borders between items, comfortable padding. On wide screens the toggles may split into two columns.',
  referral:
    'Design: a visually DISTINCT split section for a secondary audience (e.g. referring physicians) — set it on a tinted or dark panel. Copy + a compact numbered "streamlined process" list (01 / 02 / 03, each a small accent badge + a short line) on one side; a highlighted contact/CTA card (rounded, bordered, a phone/email line, a secondary button) on the other.',
  pricing:
    'Design: 2–3 plan columns as cards, the MIDDLE plan highlighted (slightly scaled or an accent border + deeper shadow + a small "Most popular" tag), each with a price, a feature checklist (small check icons), and one button. Equal full-width columns.',
  final_cta:
    'Design: a full-width CTA BANNER — an accent or dark background, centered large headline + one supporting line, generous padding, and the primary button (optionally 2–3 buttons: the main action plus 1–2 lighter secondary links). This is the closer; make it striking.',
};

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
      `Reuse ONE corner-radius and ONE soft box-shadow for every card so the page feels systematic.`,
  ];
  if (brief.designNotes) lines.push(`Art direction: ${brief.designNotes}.`);
  const roleDesign = ROLE_DESIGN[step.role];
  if (roleDesign) lines.push(roleDesign);
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
