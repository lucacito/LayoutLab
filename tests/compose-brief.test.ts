import { describe, it, expect } from 'vitest';
import { buildBriefPrompt, parseBrief } from '@/pipeline/compose/brief';

describe('buildBriefPrompt', () => {
  it('grounds on the target niche/style and asks for the structured brief fields', () => {
    const { system, prompt } = buildBriefPrompt({ type: 'full_landing', niche: 'coaching', style: 'elegant' });
    expect(system.toLowerCase()).toContain('json');
    expect(prompt).toContain('coaching');
    expect(prompt).toContain('elegant');
    for (const f of ['businessType', 'businessName', 'primaryCta', 'accentColorHex', 'conversionGoal', 'voice']) {
      expect(prompt).toContain(f);
    }
  });
});

describe('parseBrief', () => {
  const full = {
    businessType: 'course/coaching', businessName: 'Meridian Coaching', tagline: 'Lead with clarity',
    audience: 'new managers', conversionGoal: 'book a call', primaryCta: 'Book a Call',
    accentColorHex: '#E4572E', voice: 'warm, direct',
  };
  it('parses a valid brief (tolerating a prose preamble via extractJson)', () => {
    expect(parseBrief(`Here is the brief:\n${JSON.stringify(full)}`)).toEqual(full);
  });
  it('throws when a required field is missing', () => {
    const { primaryCta, ...missing } = full;
    expect(() => parseBrief(JSON.stringify(missing))).toThrow();
  });
});
