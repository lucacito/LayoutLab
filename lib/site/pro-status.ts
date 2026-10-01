// The AI Editor "Pro" plan is PAUSED. JHMG AI Editor for Divi 5 4.0.0 (free, on
// wordpress.org) has no licence-gated feature left: page creation (as drafts),
// undo, the image pack and Media Library access are all free. A separate Pro
// add-on (live stock-photo sourcing) is planned but not built and has no date.
//
// Flip this to `true` ONLY when that add-on actually ships. Flipping it only
// re-opens the server-side checkout gate (`isProductPaused`). The site copy
// was rewritten for the free plugin, so a real relaunch also needs to:
//   - restore the BuyProButton / price / trial copy on
//     app/(marketing)/plugins/divi-5-ai-editor/page.tsx and the AI Editor row
//     of app/(catalog)/pricing/page.tsx (replace the "coming soon" card),
//   - restore the "$ price" chips in lib/nav/menu-data.ts and ProductDoors,
//   - restore the Pro mention in the three connect-* guides,
//   - point the Product JSON-LD offer at the real price,
//   - re-check what the Pro add-on actually unlocks before describing it.
// All Stripe, licence-server and price env code is intentionally left in place.
export const AI_EDITOR_PRO_AVAILABLE = false as boolean;

export const AI_EDITOR_PRO_PRODUCT = 'ai-editor-divi5-pro';

// True when `product` cannot currently be bought. `aiEditorProAvailable` is a
// parameter (defaulting to the switch above) so both states are unit-testable.
export function isProductPaused(product: string, aiEditorProAvailable: boolean = AI_EDITOR_PRO_AVAILABLE): boolean {
  return product === AI_EDITOR_PRO_PRODUCT && !aiEditorProAvailable;
}
