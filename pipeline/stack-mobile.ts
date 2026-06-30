// Deterministically make Divi 5 layouts stack to a single full-width column on
// phone. The model sets the responsive attributes inconsistently, so multi-column
// flex rows render with each column stuck at its desktop fraction (e.g. flexType
// "8_24" = 1/3 width) on phone — producing ~20px columns where text wraps one
// character per line. This enforces, on the phone breakpoint only:
//   • rows    → module.decoration.layout.phone.value.flexDirection = "column"  (stack)
//   • columns → module.decoration.sizing.phone.value.flexType      = "24_24"   (full width)
// No model involved. Desktop/tablet are untouched.

const BLOCK_OPEN = /<!-- wp:divi\/(row|row-inner|column|column-inner) /g;

// String-aware balanced-object extractor (Divi attr JSON has braces inside strings).
function extractObject(s: string, start: number): { json: string; end: number } | null {
  if (s[start] !== '{') return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = start; j < s.length; j++) {
    const c = s[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return { json: s.slice(start, j + 1), end: j + 1 };
  }
  return null;
}

type Bp = { phone?: { value?: Record<string, unknown> } };
type Attrs = { module?: { decoration?: { layout?: Bp; sizing?: Bp } } };

function phoneValue(branch: 'layout' | 'sizing', attrs: Attrs): Record<string, unknown> {
  const m = (attrs.module ??= {});
  const d = (m.decoration ??= {});
  const b = (d[branch] ??= {});
  const p = (b.phone ??= {});
  return (p.value ??= {});
}

function patchBlock(blockType: string, attrs: Attrs): void {
  if (blockType === 'row' || blockType === 'row-inner') {
    phoneValue('layout', attrs).flexDirection = 'column';
  } else {
    // column / column-inner: full width on phone so it isn't stuck at its desktop fraction.
    phoneValue('sizing', attrs).flexType = '24_24';
  }
}

export function stackRowsOnMobile(postContent: string): string {
  let out = '';
  let cursor = 0;
  for (const m of postContent.matchAll(BLOCK_OPEN)) {
    const attrsStart = (m.index ?? 0) + m[0].length;
    const obj = extractObject(postContent, attrsStart);
    if (!obj) continue;
    let attrs: Attrs;
    try {
      attrs = JSON.parse(obj.json) as Attrs;
    } catch {
      continue;
    }
    patchBlock(m[1], attrs);
    out += postContent.slice(cursor, attrsStart) + JSON.stringify(attrs);
    cursor = obj.end;
  }
  return out + postContent.slice(cursor);
}

/** Apply mobile-stacking inside a full layout JSON ({ post_content, … }). */
export function stackLayoutJsonMobile(json: string): string {
  let obj: { post_content?: string };
  try {
    obj = JSON.parse(json);
  } catch {
    return json;
  }
  if (typeof obj.post_content !== 'string') return json;
  obj.post_content = stackRowsOnMobile(obj.post_content);
  return JSON.stringify(obj);
}
