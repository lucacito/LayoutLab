// tests/copy-critic.test.ts — T5.1 copy-quality gate.
//
// Two independent pieces under test: (1) `extractLayoutText`, the text extraction
// shared by the folded vision-critic prompt and the shingle gate; (2) the
// deterministic shingle-overlap boilerplate detector + the pure `meetsCopyBar`
// flag-threshold check. The LLM-scored side of the contract (the folded prompt/
// parse extension) is tested in tests/vision-critic.test.ts, since that's the
// module whose contract is being extended.
import { describe, it, expect } from 'vitest';
import {
  extractLayoutText,
  shingles,
  shingleOverlap,
  highestShingleOverlap,
  isCopyBoilerplate,
  meetsCopyBar,
  SHINGLE_SIZE,
} from '@/pipeline/copy-critic';

describe('extractLayoutText', () => {
  it('extracts prose from a flat {"content":"…"} fixture (this repo\'s simplified test shape)', () => {
    const json = JSON.stringify({
      post_title: 'T',
      post_content: '<!-- wp:divi/text {"content":"Ship faster with copy built for real teams"} -->',
    });
    expect(extractLayoutText(json)).toContain('Ship faster with copy built for real teams');
  });

  it('extracts prose from the real nested Divi 5 shape (innerContent.desktop.value)', () => {
    const json = JSON.stringify({
      post_title: 'T',
      post_content:
        '<!-- wp:divi/heading {"title":{"innerContent":{"desktop":{"value":"Same-day emergency plumbing"}}}} /-->',
    });
    expect(extractLayoutText(json)).toContain('Same-day emergency plumbing');
  });

  it('extracts a button\'s nested text value', () => {
    const json = JSON.stringify({
      post_title: 'T',
      post_content: '<!-- wp:divi/button {"button":{"innerContent":{"desktop":{"value":{"text":"Book a Free Consultation"}}}}} /-->',
    });
    expect(extractLayoutText(json)).toContain('Book a Free Consultation');
  });

  it('filters out structural noise: hex colors, spacing shorthand, and image URLs', () => {
    const json = JSON.stringify({
      post_title: 'T',
      post_content:
        '<!-- wp:divi/section {"background_color":"#2563eb","custom_padding":"40px|20px|40px|20px"} -->' +
        '<!-- wp:divi/text {"content":"Ship faster with copy built for real teams"} -->' +
        '<!-- wp:divi/image {"src":"https://images.pexels.com/photos/1/photo.jpg"} -->' +
        '<!-- /wp:divi/section -->',
    });
    const text = extractLayoutText(json);
    expect(text).toContain('Ship faster with copy built for real teams');
    expect(text).not.toMatch(/2563eb/);
    expect(text).not.toMatch(/40px/);
    expect(text).not.toMatch(/pexels/i);
  });

  it('strips embedded HTML tags/entities out of a content value', () => {
    const json = JSON.stringify({
      post_title: 'T',
      post_content: '<!-- wp:divi/text {"content":"<p>Real copy&nbsp;here today</p>"} -->',
    });
    expect(extractLayoutText(json)).toBe('Real copy here today');
  });

  it('filters single-word values (labels/eyebrows) — documented limitation', () => {
    const json = JSON.stringify({
      post_title: 'T',
      post_content: '<!-- wp:divi/text {"text_orientation":"left","content":"Two words minimum here"} -->',
    });
    const text = extractLayoutText(json);
    expect(text).not.toMatch(/\bleft\b/);
    expect(text).toContain('Two words minimum here');
  });

  it('returns "" for unparseable JSON (fails open, like content-lint)', () => {
    expect(extractLayoutText('not json')).toBe('');
  });

  it('returns "" when post_content is missing', () => {
    expect(extractLayoutText(JSON.stringify({ post_title: 'T' }))).toBe('');
  });
});

describe('shingles', () => {
  it('produces the exact set of size-n word windows', () => {
    expect(shingles('a b c d e f g h', 5)).toEqual(
      new Set(['a b c d e', 'b c d e f', 'c d e f g', 'd e f g h']),
    );
  });

  it('is case-insensitive', () => {
    expect(shingles('Hello World Foo Bar Baz', 5)).toEqual(shingles('hello world foo bar baz', 5));
  });

  it('produces an empty set when text is shorter than n', () => {
    expect(shingles('a b c', 5).size).toBe(0);
  });

  it('defaults to SHINGLE_SIZE when n is omitted', () => {
    expect(shingles('a b c d e f g h')).toEqual(shingles('a b c d e f g h', SHINGLE_SIZE));
  });
});

describe('shingleOverlap / highestShingleOverlap', () => {
  it('is 1.0 for identical text', () => {
    const t = 'we deliver quality solutions to help your business grow';
    expect(shingleOverlap(t, t)).toBe(1);
  });

  it('is 0 for completely distinct text', () => {
    const a = 'same day emergency plumbing for austin homeowners licensed and insured';
    const b = 'boutique bridal photography across the hill country booking weekends now';
    expect(shingleOverlap(a, b)).toBe(0);
  });

  it('is 0 (not NaN) when text has no shingles at all', () => {
    expect(shingleOverlap('too short', 'anything at all here')).toBe(0);
  });

  it('highestShingleOverlap picks the best match across a pool', () => {
    const t = 'we deliver quality solutions to help your business grow';
    const pool = ['completely unrelated filler text about something else entirely', t];
    expect(highestShingleOverlap(t, pool)).toBe(1);
  });

  it('highestShingleOverlap is 0 for an empty pool', () => {
    expect(highestShingleOverlap('anything with enough words in it', [])).toBe(0);
  });
});

describe('isCopyBoilerplate', () => {
  const BOILERPLATE =
    'We deliver quality solutions to help your business grow and succeed in a competitive market today';

  it('flags identical boilerplate text repeated across layouts', () => {
    expect(isCopyBoilerplate(BOILERPLATE, [BOILERPLATE])).toBe(true);
  });

  it('flags near-identical boilerplate with a single word reworded', () => {
    const reworded =
      'We deliver quality solutions to help your business grow and thrive in a competitive market today';
    expect(isCopyBoilerplate(reworded, [BOILERPLATE])).toBe(true);
  });

  it('does not flag genuinely distinct, specific copy', () => {
    const specific =
      'Same-day emergency plumbing for Austin homeowners — licensed, insured, and on your doorstep in 60 minutes';
    expect(isCopyBoilerplate(specific, [BOILERPLATE])).toBe(false);
  });

  it('does not flag text shorter than the shingle window', () => {
    expect(isCopyBoilerplate('too short to shingle', [BOILERPLATE])).toBe(false);
  });

  it('does not flag against an empty pool (first-ever occurrence)', () => {
    expect(isCopyBoilerplate(BOILERPLATE, [])).toBe(false);
  });

  it('respects a custom maxOverlap threshold', () => {
    const reworded =
      'We deliver quality solutions to help your business grow and thrive in a competitive market today';
    expect(isCopyBoilerplate(reworded, [BOILERPLATE], 0.95)).toBe(false);
    expect(isCopyBoilerplate(reworded, [BOILERPLATE], 0.1)).toBe(true);
  });
});

describe('meetsCopyBar', () => {
  it('passes at or above the threshold', () => {
    expect(meetsCopyBar(3, 3)).toBe(true);
    expect(meetsCopyBar(5, 3)).toBe(true);
  });

  it('fails below the threshold', () => {
    expect(meetsCopyBar(2, 3)).toBe(false);
  });

  it('treats a missing copyScore as passing (no signal is not a bad signal)', () => {
    expect(meetsCopyBar(undefined, 3)).toBe(true);
  });
});
