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

  it('skips an optional section that produced no content, still assembles the rest, and logs the skip', async () => {
    const threeStep = [
      { role: 'hero', sectionType: 'hero', job: 'hero job', cta: true },
      { role: 'benefits', sectionType: 'cards', job: 'benefits job', cta: false },
      { role: 'final_cta', sectionType: 'cta', job: 'cta job', cta: true },
    ];
    const empty = JSON.stringify({ post_title: 'X', post_content: '   ' });
    let n = 0;
    // brief, then hero (ok), then benefits (empty -> optional skip), then final_cta (ok)
    const outs = [JSON.stringify(brief), section(1), empty, section(2)];
    const llm = { complete: vi.fn(async () => outs[n++]) };
    const log = vi.fn();
    const { json } = await composeLanding(target as any, { llm, guide, flow: threeStep, maxParseRetries: 0, log });
    const doc = JSON.parse(json);
    expect((doc.post_content.match(/wp:divi\/section {/g) || []).length).toBe(2); // hero + final_cta only
    expect(log).toHaveBeenCalledWith(expect.stringContaining('skip optional section benefits'));
  });
});

describe('composeLanding flow selection (T3.2)', () => {
  it('logs an unmatched business type via the log callback while still composing a valid landing', async () => {
    const oddBrief = { ...brief, businessType: 'quantum widget concept' };
    let n = 0;
    const llm = { complete: vi.fn(async () => (n === 0 ? (n++, JSON.stringify(oddBrief)) : section(n++))) };
    const log = vi.fn();
    const { json } = await composeLanding(target as any, { llm, guide, log });
    const doc = JSON.parse(json);
    expect(doc.post_content).toContain('wp:divi/section');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('unmatched business type "quantum widget concept"'));
  });
});

describe('composeLanding flow-variant key stability (T3.2 review fix)', () => {
  // The flow-variant key must be built from stable Target/brief facts
  // (businessType category + niche + style), NOT the LLM-generated
  // `businessName` — a re-run of the exact same Target produces a fresh Brief
  // (and thus a fresh businessName) each time, which must not reshuffle the
  // page's section flow. `Meridian Coaching` vs. `Totally Different Name Co`
  // are picked because they hash to two DIFFERENT flow variants for the
  // course/coaching category when (incorrectly) keyed on businessName alone
  // — so this test would fail under the old keying and passes under the fix.
  async function flowSignatureFor(businessName: string): Promise<(string | undefined)[]> {
    const b = { ...brief, businessName };
    let n = 0;
    const llm = { complete: vi.fn(async () => (n === 0 ? (n++, JSON.stringify(b)) : section(n++))) };
    await composeLanding(target as any, { llm, guide });
    // Every section-generation call (i.e. every call after the brief) embeds
    // "Section role: <job>." via buildSectionRolePrompt — extract that to
    // recover which flow variant (sequence of roles/jobs) was selected.
    return llm.complete.mock.calls.slice(1).map(([arg]: any[]) => (arg.prompt.match(/Section role: [^.]+\./) ?? [])[0]);
  }

  it('selects the same flow variant regardless of businessName differences, for the same Target', async () => {
    const seqA = await flowSignatureFor('Meridian Coaching');
    const seqB = await flowSignatureFor('Totally Different Name Co');
    expect(seqA.length).toBeGreaterThan(0);
    expect(seqA).toEqual(seqB);
  });
});

describe('composeLanding per-section validation', () => {
  const invalid = { valid: false, violations: [{ code: 'BLOCK_PARSE_ERROR', message: 'bad', path: '' }] };
  const ok = { valid: true, violations: [] };

  it('validates each section and repairs an invalid one at the section level (small repair, not the whole doc)', async () => {
    // llm: brief, hero, hero-repair, final_cta. validate: hero invalid then valid, final_cta valid.
    let n = 0;
    const outs = [JSON.stringify(brief), section(1), section(11), section(2)];
    const llm = { complete: vi.fn(async () => outs[n++]) };
    let vc = 0;
    const validate = vi.fn(async () => (++vc === 1 ? invalid : ok));
    const { json } = await composeLanding(target as any, { llm, guide, flow: twoStep, maxParseRetries: 0, validate, maxRepairs: 2 });
    const doc = JSON.parse(json);
    expect((doc.post_content.match(/wp:divi\/section {/g) || []).length).toBe(2);
    expect(llm.complete).toHaveBeenCalledTimes(4); // brief + hero + hero-repair + final_cta
    expect(validate).toHaveBeenCalledTimes(3); // hero(invalid), hero(valid), final_cta(valid)
  });

  it('drops the landing when a required section never validates', async () => {
    let n = 0;
    const outs = [JSON.stringify(brief), section(1), section(1), section(1)];
    const llm = { complete: vi.fn(async () => outs[Math.min(n++, outs.length - 1)]) };
    const validate = vi.fn(async () => invalid);
    await expect(
      composeLanding(target as any, { llm, guide, flow: twoStep, maxParseRetries: 0, validate, maxRepairs: 1 }),
    ).rejects.toThrow();
  });

  it('skips an optional section that never validates and assembles the rest', async () => {
    const threeStep = [
      { role: 'hero', sectionType: 'hero', job: 'j', cta: true },
      { role: 'benefits', sectionType: 'cards', job: 'j', cta: false },
      { role: 'final_cta', sectionType: 'cta', job: 'j', cta: true },
    ];
    let n = 0;
    const outs = [JSON.stringify(brief), section(1), section(2), section(3)];
    const llm = { complete: vi.fn(async () => outs[Math.min(n++, outs.length - 1)]) };
    let vc = 0; // per-section validate: hero valid, benefits invalid, final_cta valid
    const validate = vi.fn(async () => (++vc === 2 ? invalid : ok));
    const log = vi.fn();
    const { json } = await composeLanding(target as any, { llm, guide, flow: threeStep, maxParseRetries: 0, validate, maxRepairs: 0, log });
    const doc = JSON.parse(json);
    expect((doc.post_content.match(/wp:divi\/section {/g) || []).length).toBe(2); // hero + final_cta
    expect(log).toHaveBeenCalledWith(expect.stringContaining('skip optional section benefits'));
  });
});
