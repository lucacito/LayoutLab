import { Icon } from '@/components/ui/Icon';

/** Buyer-facing notice for `shop`-type layouts: the grid (divi/shop) is dynamic
 *  and renders the buyer's WooCommerce products, so the marketplace screenshot
 *  is a demo store. Shown on the layout detail page. */
export function RequiresWooBadge() {
  return (
    <div
      role="note"
      className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <Icon name="storefront" size={18} className="mt-0.5" />
      <span>
        <strong>Requires the WooCommerce plugin.</strong> This grid displays your store&apos;s own
        products — the preview shows a demo store.
      </span>
    </div>
  );
}
