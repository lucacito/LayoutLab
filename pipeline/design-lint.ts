// pipeline/design-lint.ts — deterministic post-generation design fixes
// (rich-generator spec §5.10). Phase 1 scope: the button-centering transforms
// proven in prod (66/193 published layouts patched via scripts/fix-buttons.sh
// -> scripts/patch-live-layout.ts PATCH_MODE=center-buttons/-lone-buttons;
// see memory layoutlab-button-centering), ported to run on every FRESH layout
// before render — so the flaw is fixed at the source instead of patched live.
//
// Differences from the patch script (deliberate):
//   - No-throw: the script throws "nothing to change" (patch semantics); a
//     lint runs on every layout, so unchanged input is simply returned.
//   - Fail-open: malformed structure returns the input verbatim (logged). A
//     cosmetic fix must never drop a validated layout.
//   - Idempotent: attributes already set are left untouched, so applying the
//     lint to its own output is a no-op (tested).
// Applied in run.ts right before stackLayoutJsonMobile — both are deterministic
// attribute-only transforms, so the content hash downstream stays stable for
// identical generations (idempotency/resumability preserved).
const COL_OPEN = '<!-- wp:divi/column ';
const COL_CLOSE = '<!-- /wp:divi/column -->';
const SEC_OPEN = '<!-- wp:divi/section';
const SEC_CLOSE = '<!-- /wp:divi/section -->';
const BUTTON_RE = /<!-- wp:divi\/button {.*?} \/-->/g;

type LayoutValue = { display?: string; flexDirection?: string; alignItems?: string };

function centeredFlex(attrs: Record<string, any>): boolean {
  const val: LayoutValue =
    ((((((attrs.module ??= {}).decoration ??= {}).layout ??= {}).desktop ??= {}).value ??= {}));
  if (val.display === 'flex' && val.alignItems === 'center') return false;
  val.display = 'flex';
  val.flexDirection = 'column';
  val.alignItems = 'center';
  return true;
}

// Pass 1 (port of centerButtons, scripts/patch-live-layout.ts:351): every
// column containing BOTH a button module AND a centered-text signal becomes a
// centered flex column. `orientation:center` never moves a block/inline-block
// button; this does.
function centerButtonColumns(c: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const start = c.indexOf(COL_OPEN, i);
    if (start < 0) { out += c.slice(i); break; }
    const jsonStart = start + COL_OPEN.length;
    const tagEnd = c.indexOf(' -->', jsonStart);
    if (tagEnd < 0) throw new Error('malformed column open tag');
    const close = c.indexOf(COL_CLOSE, tagEnd);
    if (close < 0) throw new Error('unclosed column');
    const attrsRaw = c.slice(jsonStart, tagEnd);
    const inner = c.slice(tagEnd + 4, close); // detection only; never rewritten here
    const hasButton = inner.includes('<!-- wp:divi/button ');
    const centered =
      attrsRaw.includes('"orientation":"center"') ||
      inner.includes('"orientation":"center"') ||
      inner.includes('"textAlign":"center"');
    let newAttrsRaw = attrsRaw;
    if (hasButton && centered) {
      const attrs = JSON.parse(attrsRaw);
      if (centeredFlex(attrs)) newAttrsRaw = JSON.stringify(attrs);
    }
    out += c.slice(i, start) + COL_OPEN + newAttrsRaw + ' -->';
    i = tagEnd + 4; // continue right after the open tag (handles any nesting)
  }
  return out;
}

// Pass 2 (port of centerLoneButtonColumns, scripts/patch-live-layout.ts:412):
// a button alone in its own column has no centered-text signal of its own —
// center it when its enclosing SECTION reads centered (measured with button
// modules stripped, so pass 3's textAlign can't count as a signal and
// left-aligned designs are left alone).
function centerLoneButtonColumns(c: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const sStart = c.indexOf(SEC_OPEN, i);
    if (sStart < 0) { out += c.slice(i); break; }
    const sEnd = c.indexOf(SEC_CLOSE, sStart);
    if (sEnd < 0) throw new Error('unclosed section');
    const secEnd = sEnd + SEC_CLOSE.length;
    let section = c.slice(sStart, secEnd);
    const nonButton = section.replace(BUTTON_RE, '');
    const sectionCentered =
      nonButton.includes('"orientation":"center"') || nonButton.includes('"textAlign":"center"');
    if (sectionCentered) {
      let secOut = '';
      let j = 0;
      for (;;) {
        const cStart = section.indexOf(COL_OPEN, j);
        if (cStart < 0) { secOut += section.slice(j); break; }
        const jsonStart = cStart + COL_OPEN.length;
        const tagEnd = section.indexOf(' -->', jsonStart);
        const cClose = section.indexOf(COL_CLOSE, tagEnd);
        if (tagEnd < 0 || cClose < 0) throw new Error('malformed column in section');
        const attrsRaw = section.slice(jsonStart, tagEnd);
        const inner = section.slice(tagEnd + 4, cClose);
        const loneButton =
          inner.includes('<!-- wp:divi/button ') && inner.replace(BUTTON_RE, '').trim() === '';
        let newAttrsRaw = attrsRaw;
        if (loneButton) {
          const attrs = JSON.parse(attrsRaw);
          if (centeredFlex(attrs)) newAttrsRaw = JSON.stringify(attrs);
        }
        secOut += section.slice(j, cStart) + COL_OPEN + newAttrsRaw + ' -->';
        j = tagEnd + 4;
      }
      section = secOut;
    }
    out += c.slice(i, sStart) + section;
    i = secEnd;
  }
  return out;
}

// Pass 3 (port of the shared label sub-fix / centerLabels): textAlign:center
// on every button font — a visual no-op for inline-block buttons, fixes the
// left-aligned wrapped label when a phone-stretched button goes full-width.
function centerButtonLabels(c: string): string {
  return c.replace(/<!-- wp:divi\/button ({.*?}) \/-->/g, (m, j: string) => {
    const attrs = JSON.parse(j);
    const val =
      (((((((attrs.button ??= {}).decoration ??= {}).font ??= {}).font ??= {}).desktop ??= {}).value ??= {}));
    if (val.textAlign === 'center') return m;
    val.textAlign = 'center';
    return '<!-- wp:divi/button ' + JSON.stringify(attrs) + ' /-->';
  });
}

/** Deterministic button-centering lint over a full layout JSON string
 *  ({ post_title, post_content }). Idempotent; fail-open (returns the input
 *  verbatim on any parse problem, optionally logging why). */
export function applyButtonCentering(layoutJson: string, log?: (m: string) => void): string {
  try {
    const obj = JSON.parse(layoutJson) as { post_content?: unknown };
    if (typeof obj.post_content !== 'string') return layoutJson;
    let pc = obj.post_content;
    pc = centerButtonColumns(pc);
    pc = centerLoneButtonColumns(pc);
    pc = centerButtonLabels(pc);
    if (pc === obj.post_content) return layoutJson;
    obj.post_content = pc;
    return JSON.stringify(obj);
  } catch (e) {
    log?.(`[design-lint] button centering skipped: ${e instanceof Error ? e.message : String(e)}`);
    return layoutJson;
  }
}
