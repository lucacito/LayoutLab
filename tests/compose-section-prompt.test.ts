import { describe, it, expect } from 'vitest';
import { buildSectionRolePrompt } from '@/pipeline/compose/section-prompt';

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

  it('falls back to a derived palette when the brief pins none', () => {
    const p = buildSectionRolePrompt({ role: 'services', sectionType: 'cards', job: 'j', cta: false }, brief);
    expect(p).toContain(brief.accentColorHex); // primary derived from accent
    expect(p).toContain('#F8FAFC'); // default tint
  });

  it('gives each role a concrete design treatment', () => {
    const hero = buildSectionRolePrompt({ role: 'hero', sectionType: 'hero', job: 'j', cta: true }, brief);
    const process = buildSectionRolePrompt({ role: 'how_it_works', sectionType: 'cards', job: 'j', cta: false }, brief);
    const faq = buildSectionRolePrompt({ role: 'faq', sectionType: 'faq', job: 'j', cta: false }, brief);
    const cards = buildSectionRolePrompt({ role: 'services', sectionType: 'cards', job: 'j', cta: false }, brief);
    expect(hero).toMatch(/two-column hero/i);
    expect(process).toMatch(/numbered.*badge|circular badge/i);
    expect(faq).toMatch(/accordion|toggle/i);
    expect(cards).toMatch(/image-card/i);
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
