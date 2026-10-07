// The AI Editor Pro add-on is LIVE and shipping.
// JHMG AI Editor for Divi 5 Pro: 17 tools for advanced AI editing on your Divi 5
// site. Sold by annual per-site-count tier; every price, tier, limit and cap is in config/pricing.json.
// Expiry never disables features, only updates and support stop.
export const AI_EDITOR_PRO_AVAILABLE = true as boolean;

export const AI_EDITOR_PRO_PRODUCT = 'ai-editor-divi5-pro';

// True when `product` cannot currently be bought. `aiEditorProAvailable` is a
// parameter (defaulting to the switch above) so both states are unit-testable.
export function isProductPaused(product: string, aiEditorProAvailable: boolean = AI_EDITOR_PRO_AVAILABLE): boolean {
  return product === AI_EDITOR_PRO_PRODUCT && !aiEditorProAvailable;
}
