// The AI Editor Pro add-on is LIVE and shipping.
// JHMG AI Editor for Divi 5 Pro: 14 tools for advanced AI editing on your Divi 5
// site. Buy by annual per-site-count tier (Personal 1 site, Freelancer 10, Agency
// unlimited). Expiry never disables features, only updates and support stop.
// Founding offer: 30% off, first 100 buyers, price locked while active.
// Lifetime: Agency unlimited, one-time purchase, 50 capped.
export const AI_EDITOR_PRO_AVAILABLE = true as boolean;

export const AI_EDITOR_PRO_PRODUCT = 'ai-editor-divi5-pro';

// True when `product` cannot currently be bought. `aiEditorProAvailable` is a
// parameter (defaulting to the switch above) so both states are unit-testable.
export function isProductPaused(product: string, aiEditorProAvailable: boolean = AI_EDITOR_PRO_AVAILABLE): boolean {
  return product === AI_EDITOR_PRO_PRODUCT && !aiEditorProAvailable;
}
