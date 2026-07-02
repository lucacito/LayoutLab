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
});
