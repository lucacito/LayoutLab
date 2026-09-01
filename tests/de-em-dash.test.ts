import { describe, it, expect } from 'vitest';
import { deEmDash, deEmDashJson } from '@/lib/text/de-em-dash';

describe('deEmDash', () => {
  it('leaves text without em dashes untouched', () => {
    expect(deEmDash('A clean sentence, already.')).toBe('A clean sentence, already.');
  });

  describe('titles', () => {
    it('turns the separator into a colon', () => {
      expect(deEmDash('Minimal SaaS CTA — Ship Features Faster', { title: true })).toBe(
        'Minimal SaaS CTA: Ship Features Faster',
      );
    });

    it('falls back to a pipe when the title already has a colon', () => {
      expect(deEmDash('Divi 5: The Rewrite — What Changed', { title: true })).toBe(
        'Divi 5: The Rewrite | What Changed',
      );
    });

    it('falls back to a comma when the title already has a colon and a pipe', () => {
      expect(deEmDash('Hero: Split — Signup | Divi 5', { title: true })).toBe(
        'Hero: Split, Signup | Divi 5',
      );
    });

    it('keeps an existing pipe when only a pipe is present', () => {
      expect(
        deEmDash('Playful Purple Real Estate Hero — Signup Split | Divi 5 Layout', { title: true }),
      ).toBe('Playful Purple Real Estate Hero: Signup Split | Divi 5 Layout');
    });
  });

  describe('prose', () => {
    it('uses a colon when the aside is an explanatory list', () => {
      expect(
        deEmDash(
          'An elegant landing page for a fashion stylist — services grid, about, and gallery.',
        ),
      ).toBe('An elegant landing page for a fashion stylist: services grid, about, and gallery.');
    });

    it('uses a comma when the aside carries no list', () => {
      expect(deEmDash('Reservation callout — ready to import.')).toBe(
        'Reservation callout, ready to import.',
      );
    });

    it('wraps a paired aside in parentheses', () => {
      expect(
        deEmDash('A good testimonial gives a voice room — a name, a face, a result — and stays quiet.'),
      ).toBe('A good testimonial gives a voice room (a name, a face, a result) and stays quiet.');
    });

    it('does not add a second colon to a sentence that already has one', () => {
      expect(deEmDash('Built to close the loop: each one is validated — fast, and free.')).toBe(
        'Built to close the loop: each one is validated, fast, and free.',
      );
    });

    it('treats each sentence independently', () => {
      expect(deEmDash('First — one, two. Second — done.')).toBe('First: one, two. Second, done.');
    });

    it('preserves paragraph breaks in markdown bodies', () => {
      const md = '## Heading\n\nAgencies use these — on nearly every build.\n\nNext para — here.';
      expect(deEmDash(md)).toBe(
        '## Heading\n\nAgencies use these, on nearly every build.\n\nNext para, here.',
      );
    });

    it('preserves the exact spacing between sentences', () => {
      expect(deEmDash('One — two.  Three.')).toBe('One, two.  Three.');
    });

    it('adds a comma after a paired aside when the tail opens a new noun phrase', () => {
      expect(
        deEmDash('Built for stores — grids, banners, and bars — each one validated before publication.'),
      ).toBe('Built for stores (grids, banners, and bars), each one validated before publication.');
    });

    it('leaves a paired aside uncommaed when the tail continues the main clause', () => {
      expect(
        deEmDash('Layouts make small details — a hairline rule, a considered ratio — do the heavy lifting.'),
      ).toBe('Layouts make small details (a hairline rule, a considered ratio) do the heavy lifting.');
    });

    it('starts a new sentence when the aside is plainly an independent clause', () => {
      expect(deEmDash('Minimalism is not the absence of design — it is the presence of discipline.')).toBe(
        'Minimalism is not the absence of design. It is the presence of discipline.',
      );
      expect(deEmDash('Import it — it\u2019s ready to go.')).toBe('Import it. It\u2019s ready to go.');
    });

    it('does not mistake a noun phrase for a clause', () => {
      expect(deEmDash('Designed for teams — you and your clients.')).toBe(
        'Designed for teams, you and your clients.',
      );
    });

    it('breaks the sentence when the head is already a comma list', () => {
      expect(
        deEmDash('Candlelit hero, menu highlights, and reservation CTA — ready to customize.'),
      ).toBe('Candlelit hero, menu highlights, and reservation CTA. Ready to customize.');
    });

    it('still uses a comma when the head carries no list', () => {
      expect(deEmDash('A deep emerald background with neon accents — built for Divi 5.')).toBe(
        'A deep emerald background with neon accents, built for Divi 5.',
      );
    });

    it('handles an unspaced em dash', () => {
      expect(deEmDash('Fast—reliable too.')).toBe('Fast, reliable too.');
    });

    it('collapses the space before punctuation it would otherwise strand', () => {
      expect(deEmDash('Everything you need — really.')).toBe('Everything you need, really.');
    });
  });
});

describe('deEmDashJson', () => {
  it('walks nested objects and arrays', () => {
    const input = {
      metaTitle: 'Bold Hero — Divi 5 Layout',
      metaDescription: 'A hero for shops — bold, dark, and fast.',
      keywords: ['divi 5 hero — bold'],
      article: { body: 'Ready to import — no cleanup.', nested: { n: 1, ok: true, nil: null } },
    };

    expect(deEmDashJson(input)).toEqual({
      metaTitle: 'Bold Hero: Divi 5 Layout',
      metaDescription: 'A hero for shops: bold, dark, and fast.',
      keywords: ['divi 5 hero, bold'],
      article: { body: 'Ready to import, no cleanup.', nested: { n: 1, ok: true, nil: null } },
    });
  });

  it('returns a value it did not change identically', () => {
    expect(deEmDashJson({ a: 'clean', b: [1, 2] })).toEqual({ a: 'clean', b: [1, 2] });
  });
});
