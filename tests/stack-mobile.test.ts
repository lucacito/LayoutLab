import { describe, it, expect } from 'vitest';
import { stackRowsOnMobile, stackLayoutJsonMobile } from '@/pipeline/stack-mobile';

const rowAttrs = (mc: string) => JSON.parse(mc.match(/<!-- wp:divi\/row (\{.*?\}) -->/)![1]);
const colAttrs = (mc: string) => JSON.parse(mc.match(/<!-- wp:divi\/column (\{.*?\}) -->/)![1]);

describe('stackRowsOnMobile', () => {
  it('stacks rows (flexDirection column) on phone, preserving desktop structure', () => {
    const mc = '<!-- wp:divi/row {"module":{"advanced":{"columnStructure":{"desktop":{"value":"1_2,1_2"}}}}} -->';
    const a = rowAttrs(stackRowsOnMobile(mc));
    expect(a.module.decoration.layout.phone.value.flexDirection).toBe('column');
    expect(a.module.advanced.columnStructure.desktop.value).toBe('1_2,1_2');
  });

  it('makes columns full width (flexType 24_24) on phone, keeping desktop flexType', () => {
    const mc = '<!-- wp:divi/column {"module":{"decoration":{"sizing":{"desktop":{"value":{"flexType":"8_24"}}}}}} -->';
    const a = colAttrs(stackRowsOnMobile(mc));
    expect(a.module.decoration.sizing.phone.value.flexType).toBe('24_24');
    expect(a.module.decoration.sizing.desktop.value.flexType).toBe('8_24'); // desktop untouched
  });

  it('is idempotent and preserves braces inside string values', () => {
    const mc = '<!-- wp:divi/row {"module":{},"content":"a {curly} b"} -->';
    const out = stackRowsOnMobile(mc);
    expect(stackRowsOnMobile(out)).toBe(out);
    expect(rowAttrs(out).content).toBe('a {curly} b');
  });

  it('patches row-inner/column-inner and leaves non-row blocks untouched', () => {
    const mc = '<!-- wp:divi/section {"x":1} --><!-- wp:divi/row-inner {"module":{}} --><!-- wp:divi/column-inner {"module":{}} -->';
    const out = stackRowsOnMobile(mc);
    expect(out).toContain('<!-- wp:divi/section {"x":1} -->');
    expect(out).toMatch(/row-inner \{.*"flexDirection":"column"/);
    expect(out).toMatch(/column-inner \{.*"flexType":"24_24"/);
  });

  it('stackLayoutJsonMobile patches post_content and returns valid JSON', () => {
    const json = JSON.stringify({ post_title: 'P', post_content: '<!-- wp:divi/row {"module":{}} -->' });
    const out = JSON.parse(stackLayoutJsonMobile(json));
    expect(out.post_title).toBe('P');
    expect(out.post_content).toContain('"flexDirection":"column"');
  });
});
