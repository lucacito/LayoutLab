// T4.3 — SECTION_TYPES: the single per-type registry. Before this task, adding one
// new section type meant hand-editing FIVE separate maps that had to stay in sync:
//   - RECIPE_BY_TYPE   (pipeline/recipes/prompts.ts)    — curated recipe grounding
//   - KIND_BY_TYPE      (pipeline/library/exemplars.ts)  — BM25 library-retrieval gate
//   - LAYOUTS_BY_TYPE   (pipeline/recipes/matrix.ts)     — composition/layout variety
//   - ROLE_DESIGN       (pipeline/compose/section-prompt.ts) — per-role treatment variants
//   - FLOWS             (pipeline/compose/flow.ts)       — role<->type wiring for page flows
// All five are now DERIVED from SECTION_TYPES below, so a new type is defined once.
//
// IMPORTANT — roles and types are related but NOT the same namespace. A section
// TYPE (hero, features, cards, pricing, ...) is a Divi-generatable section kind
// grounded by prompts.ts/exemplars.ts/matrix.ts. A flow ROLE (hero, problem,
// solution, benefits, why, trust, ...) is a narrative slot in a page flow
// (compose/flow.ts's Steps) that gets REALIZED as some type. Several roles can
// share one type — e.g. problem/solution/features/trust/why all generate as a
// "features" type section; benefits/how_it_works/services all generate as a
// "cards" type section. That's why `roles` below is a MAP (role name -> its
// treatment variants), not a single scalar field.
//
// This module must NEVER import from the five consumers it feeds (prompts.ts,
// exemplars.ts, matrix.ts, section-prompt.ts, flow.ts) — it sits BELOW all of
// them in the dependency graph; they import FROM here, never the reverse.

/** One named, prompt-ready treatment for a role. `id` is the append-stability
 *  anchor for `pickByRendezvous` (compose/palettes.ts) — never derive it from
 *  array position. */
export interface RoleTreatment {
  id: string;
  text: string;
}

export interface SectionTypeEntry {
  /** RECIPE_BY_TYPE (prompts.ts) — curated recipe names to ground this type on,
   *  matched against the validator repo's section-recipes.json. */
  recipes?: string[];
  /** KIND_BY_TYPE (exemplars.ts) — library corpus kinds that teach this type via
   *  BM25 retrieval. An explicit `[]` (present but empty) is a DOCUMENTED corpus
   *  gap (testimonials/faq below — see exemplars.ts's long-form comment); that is
   *  different from an ABSENT key, which silently falls back to zero exemplars
   *  with no record of why. */
  libraryKinds?: string[];
  /** LAYOUTS_BY_TYPE (matrix.ts) — composition/placement variety phrases fed into
   *  buildVariants. Absent falls back to matrix.ts's generic DEFAULT_LAYOUTS —
   *  used deliberately by full_landing, whose composition is instead spelled out
   *  in full by prompts.ts's dedicated full_landing directive. */
  layouts?: string[];
  /** ROLE_DESIGN (section-prompt.ts) entries for the flow ROLE(S) that generate
   *  as this type — see the module comment above for why this is a map keyed by
   *  role, not a single role/design pair. */
  roles?: Record<string, RoleTreatment[]>;
}

export const SECTION_TYPES: Record<string, SectionTypeEntry> = {
  hero: {
    recipes: ['hero-cta', 'split-image-text'],
    libraryKinds: ['hero'],
    layouts: [
      'image on the right of the headline',
      'image on the left of the headline',
      'centered headline over a full-bleed background image',
      'split 50/50 with a sign-up form',
      'centered with a product/app shot below the CTA',
    ],
    roles: {
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
    },
  },
  cta: {
    recipes: ['newsletter-social', 'hero-cta'],
    libraryKinds: ['cta'],
    layouts: [
      'centered headline and a single button',
      'split with a supporting image on one side',
      'full-bleed banner with an overlay',
      'card-style CTA with a subtle border',
    ],
    roles: {
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
      // T4.3: "referral" has no FLOWS Step wired to it yet (a reserved/future
      // role — see section-prompt.ts's original comment), but its design reads
      // as a secondary-audience call-to-action pattern, the same family as
      // final_cta's type. Placing it here changes nothing observable: it is not
      // referenced by any Step today, so ROLE_DESIGN.referral's flattened value
      // is identical regardless of which type entry hosts it.
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
    },
  },
  features: {
    recipes: ['icon-features', 'card-grid-3'],
    libraryKinds: ['features', 'feature_detail', 'stats'],
    layouts: [
      'three columns of cards',
      'four columns with icons',
      'a two-by-two grid',
      'alternating image + text rows',
      'a left intro with a feature list on the right',
    ],
    roles: {
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
      // T4.3: "trust" (a headline-stats / credibility strip) has no FLOWS Step
      // wired to it yet, but KIND_BY_TYPE.features already includes the 'stats'
      // library kind precisely for this kind of content — the natural home for
      // its design text. See the "referral" comment above re: no observable
      // change since it's currently unreferenced by any Step.
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
    },
  },
  cards: {
    recipes: ['icon-values', 'blurb-grid', 'card-grid-3'],
    libraryKinds: ['features'],
    layouts: ['equal columns of icon cards', 'equal columns of numbered step cards'],
    roles: {
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
      // T4.3: "services" has no FLOWS Step wired to it yet — see the "referral"
      // comment above. Its design (image cards / icon-label rows) is the same
      // family as benefits/how_it_works, hence grouped under "cards" too.
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
    },
  },
  pricing: {
    recipes: ['card-grid-3', 'stats-counter'],
    libraryKinds: ['pricing'],
    layouts: [
      'three pricing columns with a highlighted middle plan',
      'a two-column comparison',
      'a single highlighted plan with a feature checklist',
    ],
    roles: {
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
    },
  },
  testimonials: {
    recipes: ['testimonial', 'section-intro'],
    // T3.4 — documented corpus gap, NOT a classifier bug: the 73-page D5 library
    // has zero divi/testimonial modules anywhere (confirmed by grep across
    // pipeline/library/d5/*.json). See exemplars.ts's long-form comment.
    libraryKinds: [],
    layouts: [
      'three-column quote cards with avatars',
      'one large featured quote with an avatar',
      'a logo strip above a featured quote',
    ],
    roles: {
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
    },
  },
  faq: {
    recipes: ['icon-features', 'section-intro'],
    // T3.4 — documented corpus gap: zero divi/toggle|divi/accordion modules
    // anywhere in the corpus. See exemplars.ts's long-form comment.
    libraryKinds: [],
    layouts: ['a two-column accordion', 'a centered single-column list', 'categorized question columns'],
    roles: {
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
    },
  },
  footer: {
    recipes: ['newsletter-social'],
    libraryKinds: ['cta', 'contact'],
    layouts: ['multi-column links with a newsletter signup', 'a centered minimal footer'],
    // No role: footer is assembled outside the FLOWS narrative spine, never a
    // per-Step sectionType.
  },
  header: {
    // Recipe grounding only — kept for parity with the pre-T4.3 RECIPE_BY_TYPE
    // literal, which had a (dead, never-generated) 'header' entry. header is
    // NEVER a generatable type: buildVariants skips it via UNSUPPORTED_TYPES
    // (matrix.ts) and it is absent from KIND_BY_TYPE/LAYOUTS_BY_TYPE/ROLE_DESIGN
    // in the pre-T4.3 code too. Do NOT add header generation (see constraints.md #5).
    recipes: ['hero-cta'],
  },
  contact: {
    recipes: ['contact-form'],
    libraryKinds: ['contact'],
    layouts: [
      'form on the left, contact details on the right',
      'a centered contact form',
      'split with a map-style image',
    ],
    // No role: contact has no FLOWS Step wired to it in the pre-T4.3 code either.
  },
  gallery: {
    recipes: ['image-gallery', 'image-carousel'],
    libraryKinds: ['gallery', 'media', 'slider'],
    layouts: ['a three-column image grid', 'a masonry-style grid', 'a horizontal image row'],
    roles: {
      // T4.3: no FLOWS Step is wired to the "gallery" role yet — see the
      // "referral" comment above — but the role name and type name coincide,
      // so it is the obvious home for this design text.
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
    },
  },
  blog: {
    // Recipe grounding only — kept for parity with the pre-T4.3 RECIPE_BY_TYPE
    // literal. blog is never a MATRIX/vary/set target today.
    recipes: ['blog-feed'],
  },
  shop: {
    // Grounded on the shop-grid recipe (validator repo section-recipes.json),
    // whose markup is a heading + divi/shop (the WooCommerce products grid).
    recipes: ['shop-grid', 'section-intro'],
    // Documented corpus gap (like testimonials/faq): the D5 library has zero
    // divi/shop modules, so there are no BM25 exemplars to retrieve.
    libraryKinds: [],
    layouts: [
      'a full-width product grid under a short heading',
      'a heading and intro line above a multi-column product grid',
      'a compact product grid with a centered section title',
    ],
    // No `roles`: shop is a standalone target type, never a flow Step's role
    // (same as footer/contact/blog).
  },
  full_landing: {
    recipes: ['hero-cta', 'icon-features', 'testimonial', 'stats-counter', 'card-grid-3'],
    libraryKinds: ['hero', 'features', 'stats', 'pricing', 'cta', 'contact'],
    // No `layouts`: full_landing's composition is spelled out in full by
    // prompts.ts's dedicated full_landing directive (buildGenerationPrompt ->
    // directives()) — it deliberately has no LAYOUTS_BY_TYPE entry pre-T4.3
    // either, and falls back to matrix.ts's generic DEFAULT_LAYOUTS.
    // No role: full_landing is the composite OUTPUT of a flow, never a Step's
    // own sectionType.
  },
};

/** Builds a `Record` from (key, value) pairs like `Object.fromEntries`, except
 *  it THROWS on a duplicate key instead of silently letting the later pair win.
 *  Both derived maps that flatten SECTION_TYPES' per-type `roles` maps back to
 *  a single flat `role -> value` shape (`ROLE_TO_TYPE` below and
 *  `section-prompt.ts`'s `ROLE_DESIGN`) share this guard: without it, a future
 *  SECTION_TYPES entry that accidentally declares a role name already used by
 *  another type would silently corrupt both maps (last-wins Object.fromEntries)
 *  with no signal until generated content quietly used the wrong design/type
 *  for that role. Exported as a pure function (no SECTION_TYPES dependency) so
 *  tests can exercise the collision against synthetic pairs without mutating
 *  the real registry. */
export function buildUniqueRecord<V>(pairs: ReadonlyArray<readonly [string, V]>, mapName: string): Record<string, V> {
  const result: Record<string, V> = {};
  for (const [key, value] of pairs) {
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      throw new Error(
        `${mapName}: duplicate key "${key}" — a role must be declared under exactly one SECTION_TYPES entry's "roles" map.`,
      );
    }
    result[key] = value;
  }
  return result;
}

/** Reverse lookup: role name -> the type it generates as. Built once from
 *  SECTION_TYPES.*.roles, so pipeline/compose/flow.ts's Step constants no
 *  longer hand-duplicate the type each role uses — the ONE place a role's
 *  type lives is its home entry's `roles` map above. Uses buildUniqueRecord
 *  (not Object.fromEntries) so a duplicate role key across two type entries
 *  throws at module-init time instead of silently corrupting the lookup. */
const ROLE_TO_TYPE: Record<string, string> = buildUniqueRecord(
  Object.entries(SECTION_TYPES).flatMap(([type, entry]) =>
    Object.keys(entry.roles ?? {}).map((role) => [role, type] as const),
  ),
  'ROLE_TO_TYPE (pipeline/recipes/section-types.ts)',
);

/** The section type a flow role generates as. Throws for an unknown role —
 *  loudly, at Step-construction time — rather than silently defaulting, since
 *  an unmapped role is always a registry omission (add the role under the
 *  right type's `roles` map in SECTION_TYPES, not here). */
export function sectionTypeForRole(role: string): string {
  const type = ROLE_TO_TYPE[role];
  if (!type) throw new Error(`sectionTypeForRole: no SECTION_TYPES entry declares a role design for role "${role}"`);
  return type;
}
