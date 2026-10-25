// Bricks element types with a dedicated converter in the Bricks→D5 plugin.
// Source of truth: the plugin's own handler registries, read at the 1.0.0 release
// (jhmg-bricks-to-divi5, commit f0330dd and later):
//   free  HandlerRegistry::defaults()                       35 names
//   Pro   Admin\HandlerRegistryFactory (brdc_woocommerce_handlers filter)  41 names
// `map-connector` is one of the 35 free names, but it only feeds a sibling `map`
// element at runtime and produces no module (the plugin reports it), so it is not
// listed here: 34 free element types become native Divi 5 modules. Bricks' four
// layout elements (section, container, block, div) are not in the registry at all:
// the structure mapper turns them into Divi sections, rows, columns and groups.

export type BricksElementGroup = {
  group: string;
  elements: string[];
};

export const BRICKS_STRUCTURE_ELEMENTS = ['section', 'container', 'block', 'div'] as const;

/** Free plugin: element types that become native Divi 5 modules. */
export const BRICKS_ELEMENT_GROUPS: BricksElementGroup[] = [
  {
    group: 'Text, buttons and media',
    elements: [
      'heading', 'text', 'text-basic', 'button', 'text-link', 'icon', 'image', 'svg', 'list', 'divider', 'code', 'counter',
    ],
  },
  {
    group: 'Video, galleries and maps',
    elements: ['video', 'image-gallery', 'map', 'map-leaflet'],
  },
  {
    group: 'Posts and site content',
    elements: [
      'post-title', 'post-content', 'post-navigation', 'post-sharing', 'post-toc', 'breadcrumbs', 'posts', 'search', 'sidebar',
    ],
  },
  {
    group: 'Navigation and branding',
    elements: ['logo', 'nav-menu', 'nav-nested', 'dropdown'],
  },
  {
    group: 'Interactive elements',
    elements: ['accordion-nested', 'tabs-nested', 'slider-nested', 'toggle', 'form'],
  },
];

/** Pro add-on: WooCommerce element types that become native Divi WooCommerce modules. */
export const BRICKS_WOO_ELEMENT_GROUPS: BricksElementGroup[] = [
  {
    group: 'Single product',
    elements: [
      'product-add-to-cart', 'product-title', 'product-price', 'product-rating', 'product-stock', 'product-content',
      'product-short-description', 'product-additional-information', 'product-meta', 'product-reviews', 'product-gallery',
      'product-tabs', 'product-related', 'product-upsells',
    ],
  },
  {
    group: 'Shop and product lists',
    elements: [
      'woocommerce-products', 'woocommerce-products-orderby', 'woocommerce-products-total-results', 'woocommerce-products-pagination',
    ],
  },
  {
    group: 'Cart',
    elements: [
      'woocommerce-cart-items', 'woocommerce-cart-collaterals', 'woocommerce-cart-v2', 'woocommerce-notice',
      'woocommerce-breadcrumbs', 'woocommerce-dynamic-fragment',
    ],
  },
  {
    group: 'Checkout',
    elements: [
      'woocommerce-checkout-customer-details', 'woocommerce-checkout-order-review', 'woocommerce-checkout-order-payment',
      'woocommerce-checkout-login', 'woocommerce-checkout-coupon', 'woocommerce-checkout-billing-address',
      'woocommerce-checkout-shipping-address', 'woocommerce-payment-options', 'woocommerce-checkout-account-fields',
      'woocommerce-checkout-v2', 'woocommerce-shipping-options', 'woocommerce-checkout-place-order', 'woocommerce-checkout-step',
      'woocommerce-checkout-steps-nav', 'woocommerce-checkout-step-nav-item', 'woocommerce-form-field', 'woocommerce-form-submit',
    ],
  },
];

const count = (groups: BricksElementGroup[]) => groups.reduce((n, g) => n + g.elements.length, 0);

/** Free element types with a handler that writes a native module (34). */
export const BRICKS_ELEMENT_TYPES_MAPPED = count(BRICKS_ELEMENT_GROUPS);

/** WooCommerce element types the Pro add-on converts (41). */
export const BRICKS_WOO_ELEMENT_TYPES_MAPPED = count(BRICKS_WOO_ELEMENT_GROUPS);

/** Real Bricks layouts (library templates and captured sites) the converter's corpus sweep converts and validates, with zero errors. */
export const BRICKS_CORPUS_LAYOUTS = 867;
