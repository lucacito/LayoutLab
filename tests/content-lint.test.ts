import { describe, it, expect } from 'vitest';
import { lintLayoutContent, lintLayoutJson } from '@/pipeline/content-lint';

describe('lintLayoutContent — placeholder/filler detection', () => {
  it('passes clean, specific marketing copy', () => {
    const clean =
      '<!-- wp:divi/heading {"content":"Ship support tickets in 4 minutes"} --><!-- wp:divi/text {"content":"Helpwave auto-triages every inbound ticket and drafts replies in your brand voice."} -->';
    expect(lintLayoutContent(clean)).toEqual([]);
  });

  it('flags lorem ipsum filler', () => {
    const codes = lintLayoutContent('Lorem ipsum dolor sit amet, consectetur.').map((v) => v.code);
    expect(codes).toContain('LOREM_IPSUM');
  });

  it('flags Divi demo filler "Your content goes here"', () => {
    const codes = lintLayoutContent('Your content goes here. Edit or remove this text inline.').map((v) => v.code);
    expect(codes).toContain('DIVI_FILLER');
  });

  it('flags a leftover uppercase EYEBROW placeholder token', () => {
    const codes = lintLayoutContent('"content":"EYEBROW — ESTABLISHED 2014"').map((v) => v.code);
    expect(codes).toContain('EYEBROW_TOKEN');
  });

  it('flags a title-case "Eyebrow —" placeholder label (render uppercases it via CSS)', () => {
    const codes = lintLayoutContent('"content":"Eyebrow — Established 2014"').map((v) => v.code);
    expect(codes).toContain('EYEBROW_TOKEN');
  });

  it('does NOT flag the word eyebrow used in real prose', () => {
    const codes = lintLayoutContent('Our tinted brow gel shapes every eyebrow in seconds.').map((v) => v.code);
    expect(codes).not.toContain('EYEBROW_TOKEN');
  });

  it('flags bracketed replace/insert tokens', () => {
    expect(lintLayoutContent('[Replace: client name]').map((v) => v.code)).toContain('BRACKET_TOKEN');
    expect(lintLayoutContent('[Insert your headline here]').map((v) => v.code)).toContain('BRACKET_TOKEN');
    expect(lintLayoutContent('Only [$XX/month] left').map((v) => v.code)).toContain('BRACKET_TOKEN');
  });

  it('does NOT flag ordinary bracketed prose', () => {
    const codes = lintLayoutContent('Plans start at $29 (billed annually) [most popular].').map((v) => v.code);
    expect(codes).not.toContain('BRACKET_TOKEN');
  });

  it('flags XX price placeholders', () => {
    expect(lintLayoutContent('"content":"$XX/month"').map((v) => v.code)).toContain('PRICE_PLACEHOLDER');
    expect(lintLayoutContent('Just XX/mo').map((v) => v.code)).toContain('PRICE_PLACEHOLDER');
  });

  it('flags example.com contact addresses', () => {
    expect(lintLayoutContent('hello@example.com').map((v) => v.code)).toContain('EXAMPLE_EMAIL');
    expect(lintLayoutContent('support@example.org').map((v) => v.code)).toContain('EXAMPLE_EMAIL');
  });

  it('flags reserved 555-01xx fictional phone numbers', () => {
    expect(lintLayoutContent('Call (415) 555-0142').map((v) => v.code)).toContain('FAKE_PHONE');
    expect(lintLayoutContent('555-0199').map((v) => v.code)).toContain('FAKE_PHONE');
  });

  it('does NOT flag a normal phone number', () => {
    expect(lintLayoutContent('Call (415) 226-8471').map((v) => v.code)).not.toContain('FAKE_PHONE');
  });

  it('flags unresolved placeholder image hosts (loremflickr / placehold.co)', () => {
    expect(lintLayoutContent('"src":"https://loremflickr.com/800/600/food"').map((v) => v.code)).toContain('PLACEHOLDER_IMAGE');
    expect(lintLayoutContent('"src":"https://placehold.co/1200x800"').map((v) => v.code)).toContain('PLACEHOLDER_IMAGE');
  });

  it('flags an empty image src', () => {
    expect(lintLayoutContent('<!-- wp:divi/image {"module":{"advanced":{"htmlAttributes":{"src":""}}}} -->').map((v) => v.code)).toContain('EMPTY_IMAGE');
  });

  it('collapses repeats — one violation per code with a sample', () => {
    const out = lintLayoutContent('lorem ipsum ... lorem ipsum ... lorem ipsum');
    const lorem = out.filter((v) => v.code === 'LOREM_IPSUM');
    expect(lorem).toHaveLength(1);
    expect(lorem[0].sample.toLowerCase()).toContain('lorem');
  });

  it('lintLayoutJson lints the post_content of a layout document', () => {
    const json = JSON.stringify({ post_title: 'X', post_content: 'Your content goes here' });
    expect(lintLayoutJson(json).map((v) => v.code)).toContain('DIVI_FILLER');
  });

  it('lintLayoutJson returns [] for unparseable input (fails open)', () => {
    expect(lintLayoutJson('not json')).toEqual([]);
  });
});
