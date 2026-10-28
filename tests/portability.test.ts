import { describe, it, expect } from 'vitest';
import { toDiviPortability } from '@/lib/download/portability';

const bare = JSON.stringify({ post_title: 'Kiln & Clay Home', post_content: '<!-- wp:divi/section {} /-->' });

describe('toDiviPortability', () => {
  it('wraps a bare layout in the shape Divi\'s exporter writes', () => {
    const out = JSON.parse(toDiviPortability(bare));
    expect(out.context).toBe('et_builder');
    expect(out.data['1']).toEqual({ post_title: 'Kiln & Clay Home', post_content: '<!-- wp:divi/section {} /-->' });
    expect(out).toMatchObject({ presets: '', global_colors: '', global_variables: '', images: [], thumbnails: [] });
  });
  it('never wraps twice', () => {
    const once = toDiviPortability(bare);
    expect(toDiviPortability(once)).toBe(once);
  });
  it('leaves anything that is not a bare layout untouched', () => {
    for (const s of ['not json', '[]', 'null', '{"a":1}', '{"post_content":5}']) expect(toDiviPortability(s)).toBe(s);
  });
  it('keeps the page content byte for byte', () => {
    const content = '<!-- wp:divi/text {"a":"\\u003c\\u0026"} -->é "quoted" \\ backslash<!-- /wp:divi/text -->';
    const out = JSON.parse(toDiviPortability(JSON.stringify({ post_title: 't', post_content: content })));
    expect(out.data['1'].post_content).toBe(content);
  });
  it('carries global colors when given', () => {
    const out = JSON.parse(toDiviPortability(bare, { globalColors: [['gcid-kiln-ink', { color: '#2b2622', label: 'Kiln ink', status: 'active' }]] }));
    expect(out.global_colors).toEqual([['gcid-kiln-ink', { color: '#2b2622', label: 'Kiln ink', status: 'active' }]]);
  });
  it('carries module presets when given', () => {
    const presets = { module: { 'divi/text': { default: '', items: { p1: { id: 'p1', name: 'Kiln Body' } } } }, group: [] };
    expect(JSON.parse(toDiviPortability(bare, { presets })).presets).toEqual(presets);
  });
});
