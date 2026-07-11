import { describe, expect, it } from 'vitest';
import { applyButtonCentering } from '@/pipeline/design-lint';

const wrap = (post_content: string) => JSON.stringify({ post_title: 't', post_content });
const content = (json: string) => (JSON.parse(json) as { post_content: string }).post_content;

const BUTTON = '<!-- wp:divi/button {"button":{"innerContent":{"desktop":{"value":{"text":"Go"}}}}} /-->';
const CENTERED_COL_ATTRS = '{"module":{"advanced":{"text":{"text":{"desktop":{"value":{"orientation":"center"}}}}}}}';

const centeredColWithButton = wrap(
  `<!-- wp:divi/section {} --><!-- wp:divi/column ${CENTERED_COL_ATTRS} -->` +
    `<!-- wp:divi/text {} --><p>Hi</p><!-- /wp:divi/text -->${BUTTON}` +
    `<!-- /wp:divi/column --><!-- /wp:divi/section -->`,
);

describe('applyButtonCentering', () => {
  it('pass 1: a centered-text column containing a button becomes a centered flex column', () => {
    const out = content(applyButtonCentering(centeredColWithButton));
    expect(out).toContain('"display":"flex"');
    expect(out).toContain('"flexDirection":"column"');
    expect(out).toContain('"alignItems":"center"');
  });

  it('label pass: every button font gets textAlign:center', () => {
    const out = content(applyButtonCentering(centeredColWithButton));
    expect(out).toContain('"textAlign":"center"');
  });

  it('pass 2: a LONE-button column inside a centered section is centered too', () => {
    const loneButtonInCenteredSection = wrap(
      `<!-- wp:divi/section {} -->` +
        `<!-- wp:divi/column {} --><!-- wp:divi/heading {"title":{"innerContent":{"desktop":{"value":{"text":"H"}}},"decoration":{}},"module":{"advanced":{"text":{"text":{"desktop":{"value":{"textAlign":"center"}}}}}}} /--><!-- /wp:divi/column -->` +
        `<!-- wp:divi/column {} -->${BUTTON}<!-- /wp:divi/column -->` +
        `<!-- /wp:divi/section -->`,
    );
    const out = content(applyButtonCentering(loneButtonInCenteredSection));
    // the lone-button column (second) must now be a centered flex column
    const secondCol = out.split('<!-- wp:divi/column ')[2];
    expect(secondCol).toContain('"alignItems":"center"');
  });

  it('leaves a left-aligned design\'s columns alone (labels only)', () => {
    const leftAligned = wrap(
      `<!-- wp:divi/section {} --><!-- wp:divi/column {} -->` +
        `<!-- wp:divi/text {} --><p>Left</p><!-- /wp:divi/text -->${BUTTON}` +
        `<!-- /wp:divi/column --><!-- /wp:divi/section -->`,
    );
    const out = content(applyButtonCentering(leftAligned));
    expect(out).not.toContain('"display":"flex"'); // no column change
    expect(out).toContain('"textAlign":"center"'); // labels still centered (prod-proven pass)
  });

  it('is idempotent', () => {
    const once = applyButtonCentering(centeredColWithButton);
    expect(applyButtonCentering(once)).toBe(once);
  });

  it('fails open: malformed post_content returns the input verbatim', () => {
    const malformed = wrap('<!-- wp:divi/column {"a":1} --> no close');
    expect(applyButtonCentering(malformed)).toBe(malformed);
    expect(applyButtonCentering('not json at all')).toBe('not json at all');
    expect(applyButtonCentering(JSON.stringify({ post_title: 'no content' }))).toBe(JSON.stringify({ post_title: 'no content' }));
  });
});
