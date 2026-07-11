import { describe, it, expect } from 'vitest';
import { buildSectionRolePrompt, ROLE_DESIGN, selectRoleTreatmentId } from '@/pipeline/compose/section-prompt';
import { selectPalette } from '@/pipeline/compose/palettes';

const brief = {
  businessType: 'course/coaching', businessName: 'Meridian Coaching', tagline: 'Lead with clarity',
  audience: 'new managers', conversionGoal: 'book a call', primaryCta: 'Book a Call',
  accentColorHex: '#E4572E', voice: 'warm, direct',
};

describe('buildSectionRolePrompt', () => {
  it('injects the shared brief so every section is cohesive', () => {
    const p = buildSectionRolePrompt({ role: 'hero', sectionType: 'hero', job: 'Say what is offered.', cta: true }, brief);
    expect(p).toContain('Meridian Coaching');
    expect(p).toContain('#E4572E');
    expect(p).toContain('Book a Call');
    expect(p).toContain('Say what is offered.');
  });
  it('only tells cta:true sections to place the primary CTA button', () => {
    const withCta = buildSectionRolePrompt({ role: 'hero', sectionType: 'hero', job: 'j', cta: true }, brief);
    const noCta = buildSectionRolePrompt({ role: 'problem', sectionType: 'features', job: 'j', cta: false }, brief);
    expect(withCta).toMatch(/primary CTA/i);
    expect(noCta).not.toMatch(/primary CTA button/i);
  });

  it('threads a shared design-system palette into every section', () => {
    const withPalette = buildSectionRolePrompt({ role: 'why', sectionType: 'features', job: 'j', cta: false }, {
      ...brief,
      palette: { primary: '#0E7C86', secondary: '#1F6FB2', tint: '#F1F5F9', dark: '#0F172A', heading: '#0F172A', body: '#334155' },
    });
    expect(withPalette).toContain('#0E7C86'); // primary
    expect(withPalette).toContain('#F1F5F9'); // tint
    expect(withPalette).toMatch(/design system/i);
  });

  it('falls back to a style-selected palette when the brief pins none', () => {
    const expected = selectPalette({ style: 'minimal', niche: 'saas' }, brief.accentColorHex);
    const p = buildSectionRolePrompt(
      { role: 'services', sectionType: 'cards', job: 'j', cta: false },
      brief,
      { style: 'minimal', niche: 'saas' },
    );
    expect(p).toContain(brief.accentColorHex); // primary derived from accent
    expect(p).toContain(expected.tint);
  });

  it('derives a visibly different palette for a different style when the brief pins none', () => {
    const minimal = buildSectionRolePrompt(
      { role: 'services', sectionType: 'cards', job: 'j', cta: false },
      brief,
      { style: 'minimal', niche: 'saas' },
    );
    const dark = buildSectionRolePrompt(
      { role: 'services', sectionType: 'cards', job: 'j', cta: false },
      brief,
      { style: 'dark', niche: 'saas' },
    );
    const minimalPalette = selectPalette({ style: 'minimal', niche: 'saas' }, brief.accentColorHex);
    const darkPalette = selectPalette({ style: 'dark', niche: 'saas' }, brief.accentColorHex);
    expect(minimal).toContain(minimalPalette.tint);
    expect(dark).toContain(darkPalette.tint);
    expect(minimalPalette.tint).not.toBe(darkPalette.tint);
  });

  it('gives each role a concrete design treatment matching whichever variant was selected', () => {
    const ctx = { style: 'minimal', niche: 'saas' };
    for (const role of ['hero', 'how_it_works', 'faq', 'services']) {
      // buildSectionRolePrompt threads brief.businessName into treatment
      // selection (rich-generator entropy) — match that here so the
      // independently-computed `id` picks the same variant.
      const id = selectRoleTreatmentId(role, { ...ctx, businessName: brief.businessName });
      const variant = ROLE_DESIGN[role].find((v) => v.id === id)!;
      const p = buildSectionRolePrompt({ role, sectionType: 'x', job: 'j', cta: false }, brief, ctx);
      expect(p).toContain(variant.text);
    }
  });

  describe('per-role treatment variants (T3.2)', () => {
    it('every role offers 2-3 stable-id treatment variants', () => {
      for (const [role, variants] of Object.entries(ROLE_DESIGN)) {
        expect(variants.length).toBeGreaterThanOrEqual(2);
        expect(variants.length).toBeLessThanOrEqual(3);
        const ids = variants.map((v) => v.id);
        expect(new Set(ids).size).toBe(ids.length); // ids unique within the role
        for (const v of variants) expect(v.id.startsWith(`${role}-`)).toBe(true);
      }
      // The brief's own examples exist as real variants.
      expect(ROLE_DESIGN.hero.map((v) => v.id)).toEqual(
        expect.arrayContaining(['hero-split', 'hero-centered-fullbleed', 'hero-offset-image']),
      );
      expect(ROLE_DESIGN.faq.map((v) => v.id)).toEqual(
        expect.arrayContaining(['faq-accordion', 'faq-two-column-list']),
      );
    });

    it('selectRoleTreatmentId is a pure, deterministic function of (role, style, niche)', () => {
      const ctx = { style: 'bold', niche: 'agency' };
      expect(selectRoleTreatmentId('hero', ctx)).toBe(selectRoleTreatmentId('hero', ctx));
      expect(selectRoleTreatmentId('faq', ctx)).toBe(selectRoleTreatmentId('faq', ctx));
    });

    it('two different styles select a different treatment for at least one role (acceptance criterion)', () => {
      const roles = Object.keys(ROLE_DESIGN);
      const idsFor = (style: string) => roles.map((r) => selectRoleTreatmentId(r, { style, niche: 'saas' }));
      const styles = ['minimal', 'bold', 'dark', 'corporate', 'playful', 'elegant'];
      const base = idsFor(styles[0]);
      for (const style of styles.slice(1)) {
        expect(idsFor(style)).not.toEqual(base);
      }
    });

    it('buildSectionRolePrompt for the same role differs in treatment text between two styles somewhere in a full flow', () => {
      const roles = Object.keys(ROLE_DESIGN);
      const minimalTexts = roles.map((role) =>
        buildSectionRolePrompt({ role, sectionType: 'x', job: 'j', cta: false }, brief, { style: 'minimal', niche: 'saas' }),
      );
      const darkTexts = roles.map((role) =>
        buildSectionRolePrompt({ role, sectionType: 'x', job: 'j', cta: false }, brief, { style: 'dark', niche: 'saas' }),
      );
      expect(minimalTexts).not.toEqual(darkTexts);
    });
  });

  it('tells the model to swap to the tint color for heading/body text on the dark panel', () => {
    const p = buildSectionRolePrompt(
      { role: 'final_cta', sectionType: 'cta', job: 'j', cta: true },
      brief,
      { style: 'dark', niche: 'saas' },
    );
    const palette = selectPalette({ style: 'dark', niche: 'saas' }, brief.accentColorHex);
    expect(p).toContain(palette.dark);
    expect(p).toMatch(/on the dark background/i);
    // The substitute text color on dark must be the tint, not the (illegible) heading/body colors.
    expect(p).toContain(palette.tint);
  });

  it('threads the landing-guide blueprint into the prompt when provided (T3.3)', () => {
    const withBlueprint = buildSectionRolePrompt(
      { role: 'hero', sectionType: 'hero', job: 'j', cta: true },
      brief,
      { style: 'minimal', niche: 'saas', landingBlueprint: 'hero → problem → benefits → final CTA (start trial).' },
    );
    expect(withBlueprint).toContain('Strategic blueprint for this business type');
    expect(withBlueprint).toContain('hero → problem → benefits → final CTA (start trial).');
  });

  it('omits the blueprint line when none is provided — fail-soft (T3.3)', () => {
    const withoutBlueprint = buildSectionRolePrompt(
      { role: 'hero', sectionType: 'hero', job: 'j', cta: true },
      brief,
      { style: 'minimal', niche: 'saas' },
    );
    expect(withoutBlueprint).not.toContain('Strategic blueprint');
  });

  it('alternates the background rhythm by section index', () => {
    const even = buildSectionRolePrompt({ role: 'why', sectionType: 'features', job: 'j', cta: false }, brief, { index: 2, total: 6 });
    const odd = buildSectionRolePrompt({ role: 'why', sectionType: 'features', job: 'j', cta: false }, brief, { index: 3, total: 6 });
    expect(even).toMatch(/white\/near-white/i);
    expect(odd).toMatch(/tinted panel/i);
  });

  it('always closes the final CTA on a bold background', () => {
    const cta = buildSectionRolePrompt({ role: 'final_cta', sectionType: 'cta', job: 'j', cta: true }, brief, { index: 5, total: 6 });
    expect(cta).toMatch(/CTA BANNER/i);
    expect(cta).toMatch(/accent.*or.*dark|strong close/i);
  });
});

describe('rich-generator phase 1 (entropy + cohesion swap)', () => {
  const step = { role: 'benefits', sectionType: 'cards', job: 'j', cta: false } as const;
  const mkBrief = (businessName: string) => ({
    businessType: 'SaaS', businessName, tagline: 't', audience: 'a',
    conversionGoal: 'g', primaryCta: 'Start', accentColorHex: '#E4572E', voice: 'v',
  });

  it('drops the ONE-corner-radius mandate; defers to the page design system', () => {
    const p = buildSectionRolePrompt(step, mkBrief('Acme'), { style: 'minimal', niche: 'saas' });
    expect(p).not.toContain('Reuse ONE corner-radius');
    expect(p).toContain('page design system');
  });

  it('role-treatment entropy: same (style,niche), different businessName -> >=2 distinct treatments across 20 briefs', () => {
    const ids = new Set(
      Array.from({ length: 20 }, (_, i) =>
        selectRoleTreatmentId('benefits', { style: 'minimal', niche: 'saas', businessName: `Biz ${i}` }),
      ),
    );
    expect(ids.size).toBeGreaterThanOrEqual(2);
  });

  it('treatment selection stays deterministic per businessName', () => {
    const ctx = { style: 'minimal', niche: 'saas', businessName: 'Acme' };
    expect(selectRoleTreatmentId('benefits', ctx)).toBe(selectRoleTreatmentId('benefits', { ...ctx }));
  });

  it('existing two-arg calls still work (backward compat)', () => {
    expect(selectRoleTreatmentId('benefits', { style: 'minimal', niche: 'saas' })).toBeTruthy();
  });
});
