import { describe, it, expect } from 'vitest';
import { faqJsonLd } from '@/lib/seo/jsonld';

describe('faqJsonLd', () => {
  it('builds a FAQPage with each question + answer', () => {
    const ld = faqJsonLd([{ question: 'Q1?', answer: 'A1' }, { question: 'Q2?', answer: 'A2' }]) as any;
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity).toHaveLength(2);
    expect(ld.mainEntity[0]['@type']).toBe('Question');
    expect(ld.mainEntity[0].name).toBe('Q1?');
    expect(ld.mainEntity[0].acceptedAnswer.text).toBe('A1');
  });
});
