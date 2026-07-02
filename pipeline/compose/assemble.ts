const PH_OPEN = '<!-- wp:divi/placeholder -->';
const PH_CLOSE = '<!-- /wp:divi/placeholder -->';

// A valid Divi page post_content is exactly one placeholder wrapper around N
// section blocks. Each generated section arrives wrapped in its own placeholder;
// strip those and re-wrap the concatenation once. (Validity-preserving — verified
// against the deterministic validator.)
export function assembleSections(postContents: string[]): string {
  const inner = postContents
    .map((pc) => pc.split(PH_OPEN).join('').split(PH_CLOSE).join('').trim())
    .filter((pc) => pc.length > 0)
    .join('');
  return PH_OPEN + inner + PH_CLOSE;
}
