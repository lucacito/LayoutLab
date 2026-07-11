import { describe, expect, it } from 'vitest';
import { pickByRendezvous } from '@/pipeline/rendezvous';
import { pickByRendezvous as reExported } from '@/pipeline/compose/palettes';
import {
  DESIGN_LANGUAGES,
  buildLanguageDirective,
  designDiscriminator,
  designLanguagesEnabled,
  selectDesignLanguage,
  selectDesignLanguageId,
  selectLanguageVariantId,
} from '@/pipeline/compose/design-language';
import { AXIS_VALUES } from '@/lib/catalog/filters';

describe('rendezvous extraction', () => {
  it('palettes re-exports the same pickByRendezvous', () => {
    expect(reExported).toBe(pickByRendezvous);
  });
});

describe('DESIGN_LANGUAGES registry', () => {
  it('has 6 languages with globally unique language and variant ids', () => {
    expect(DESIGN_LANGUAGES).toHaveLength(6);
    const langIds = DESIGN_LANGUAGES.map((l) => l.id);
    expect(new Set(langIds).size).toBe(6);
    const variantIds = DESIGN_LANGUAGES.flatMap((l) => l.variants.map((v) => v.id));
    expect(new Set(variantIds).size).toBe(variantIds.length);
  });

  it('every language has >=2 variants and complete prose/scale fields', () => {
    for (const l of DESIGN_LANGUAGES) {
      expect(l.variants.length).toBeGreaterThanOrEqual(2);
      expect(l.cardSurface.length).toBeGreaterThan(20);
      expect(l.buttons.length).toBeGreaterThan(20);
      for (const key of ['sectionPaddingY', 'h1', 'h2', 'eyebrow', 'body', 'cardPadding', 'gridGap'] as const) {
        expect(l.scale[key], `${l.id}.scale.${key}`).toMatch(/\d/); // numeric, not adjectives
      }
      for (const v of l.variants) {
        expect(v.display.length).toBeGreaterThan(2);
        expect(v.body.length).toBeGreaterThan(2);
        expect(v.eyebrow.length).toBeGreaterThan(5);
      }
    }
  });

  it('covers every catalog style with >=2 languages, and every language is reachable', () => {
    for (const s of AXIS_VALUES.style) {
      const eligible = DESIGN_LANGUAGES.filter((l) => l.eligibleStyles.includes(s));
      expect(eligible.length, `style "${s}"`).toBeGreaterThanOrEqual(2);
    }
    for (const l of DESIGN_LANGUAGES) {
      expect(l.eligibleStyles.some((s) => (AXIS_VALUES.style as readonly string[]).includes(s)), `language "${l.id}" unreachable`).toBe(true);
    }
  });

  it('ownership rule: language prose never dictates section structure', () => {
    // Coarse word-list guard (spec §4/§7): surface fields must not smuggle in
    // structural instructions that belong to role treatments.
    const banned = /\b(timeline|numbered step|accordion|three columns|two columns|testimonial)\b/i;
    for (const l of DESIGN_LANGUAGES) {
      expect(l.cardSurface).not.toMatch(banned);
      expect(l.buttons).not.toMatch(banned);
    }
  });
});

describe('selection', () => {
  it('is deterministic: same inputs -> same language + variant', () => {
    const t = { style: 'minimal', niche: 'saas', designKey: 'Acme Analytics' };
    expect(selectDesignLanguageId(t)).toBe(selectDesignLanguageId({ ...t }));
    expect(selectLanguageVariantId(t)).toBe(selectLanguageVariantId({ ...t }));
  });

  it('respects the style eligibility gate', () => {
    for (const s of AXIS_VALUES.style) {
      const { language } = selectDesignLanguage({ style: s, niche: 'saas', designKey: 'k' });
      expect(language.eligibleStyles).toContain(s);
    }
  });

  it('variant belongs to the selected language', () => {
    const t = { style: 'bold', niche: 'fitness', designKey: 'PulseGrid' };
    const { language, variant } = selectDesignLanguage(t);
    expect(language.variants.map((v) => v.id)).toContain(variant.id);
  });

  it('ENTROPY REGRESSION (spec §5.3): same (style,niche), different discriminators -> more than one language', () => {
    // The v1 flaw: style|niche alone gave every Healthcare+Corporate page ONE
    // language forever. With the discriminator, 20 different business names
    // must spread across >=2 languages (deterministically).
    const ids = new Set(
      Array.from({ length: 20 }, (_, i) =>
        selectDesignLanguageId({ style: 'corporate', niche: 'real_estate', designKey: `Business ${i}` }),
      ),
    );
    expect(ids.size).toBeGreaterThanOrEqual(2);
  });

  it('unknown style falls back without throwing', () => {
    const { language } = selectDesignLanguage({ style: 'nonexistent', niche: 'saas', designKey: 'k' });
    expect(language).toBeDefined();
  });

  it('pins concrete selections (append-stability tripwire, like compose-palettes)', () => {
    const picks = [
      { style: 'minimal', niche: 'saas', designKey: 'Acme Analytics' },
      { style: 'corporate', niche: 'real_estate', designKey: 'Harborline Group' },
      { style: 'elegant', niche: 'coaching', designKey: 'Maison Verity' },
      { style: 'bold', niche: 'fitness', designKey: 'PulseGrid' },
    ].map((t) => `${selectDesignLanguageId(t)}/${selectLanguageVariantId(t)}`);
    expect(picks).toMatchInlineSnapshot(`
      [
        "editorial/editorial-playfair",
        "editorial/editorial-fraunces",
        "luxe/luxe-marcellus",
        "bold-vibrant/bold-vibrant-grotesk",
      ]
    `);
  });
});

describe('designDiscriminator', () => {
  it('prefers designKey, then variant.group, then color|layout', () => {
    expect(designDiscriminator({ designKey: 'Acme', variant: { group: 'g' }, color: 'c', layout: 'l' })).toBe('Acme');
    expect(designDiscriminator({ variant: { group: 'cards-saas-minimal' }, color: 'c', layout: 'l' })).toBe('cards-saas-minimal');
    expect(designDiscriminator({ color: 'warm', layout: 'three columns' })).toBe('warm|three columns');
    expect(designDiscriminator({})).toBe('|');
  });
});

describe('buildLanguageDirective', () => {
  it('emits the full system: id, typography, scale numbers, buttons, cards, spacing', () => {
    const { language, variant } = selectDesignLanguage({ style: 'minimal', niche: 'saas', designKey: 'Acme' });
    const d = buildLanguageDirective(language, variant);
    expect(d).toContain(`${language.id}/${variant.id}`);
    expect(d).toContain(variant.display);
    expect(d).toContain(language.scale.h1);
    expect(d).toContain(language.buttons);
    expect(d).toContain(language.cardSurface);
    expect(d).toContain(language.scale.sectionPaddingY);
  });
});

describe('designLanguagesEnabled', () => {
  it('defaults on; DESIGN_LANGUAGES=0 disables', () => {
    const prev = process.env.DESIGN_LANGUAGES;
    delete process.env.DESIGN_LANGUAGES;
    expect(designLanguagesEnabled()).toBe(true);
    process.env.DESIGN_LANGUAGES = '0';
    expect(designLanguagesEnabled()).toBe(false);
    if (prev === undefined) delete process.env.DESIGN_LANGUAGES;
    else process.env.DESIGN_LANGUAGES = prev;
  });
});
