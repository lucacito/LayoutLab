import { describe, it, expect, vi } from 'vitest';
import { composeLanding } from '@/pipeline/compose';

const guide = { style: 's', schema: 'sc', examples: ['{"e":1}'] };
const target = { type: 'full_landing', niche: 'coaching', style: 'elegant' };
const brief = {
  businessType: 'course/coaching', businessName: 'Meridian Coaching', tagline: 'Lead with clarity',
  audience: 'new managers', conversionGoal: 'book a call', primaryCta: 'Book a Call',
  accentColorHex: '#E4572E', voice: 'warm, direct',
};
const section = (n: number) =>
  JSON.stringify({ post_title: `S${n}`, post_content: `<!-- wp:divi/placeholder --><!-- wp:divi/section {"i":${n}} -->x<!-- /wp:divi/section --><!-- /wp:divi/placeholder -->` });
const twoStep = [
  { role: 'hero', sectionType: 'hero', job: 'hero job', cta: true },
  { role: 'final_cta', sectionType: 'cta', job: 'cta job', cta: true },
];

// Stub LLM: first call → brief; each later call → a distinct section doc.
function stubLlm() {
  let n = 0;
  return { complete: vi.fn(async () => (n === 0 ? (n++, JSON.stringify(brief)) : section(n++))) };
}

describe('composeLanding', () => {
  it('generates the brief then each section and assembles one document', async () => {
    const llm = stubLlm();
    const { json } = await composeLanding(target as any, { llm, guide, flow: twoStep });
    const doc = JSON.parse(json);
    expect(doc.post_title).toContain('Meridian Coaching');
    expect((doc.post_content.match(/wp:divi\/placeholder -->/g) || []).length).toBe(2); // one wrapper
    expect((doc.post_content.match(/wp:divi\/section {/g) || []).length).toBe(2); // both sections
    expect(llm.complete).toHaveBeenCalledTimes(3); // 1 brief + 2 sections
  });

  it('drops (throws) when a required section fails to generate', async () => {
    let n = 0;
    const llm = {
      complete: vi.fn(async () => {
        if (n++ === 0) return JSON.stringify(brief);
        return 'no json here'; // every section fails to parse
      }),
    };
    await expect(composeLanding(target as any, { llm, guide, flow: twoStep, maxParseRetries: 0 })).rejects.toThrow();
  });
});
