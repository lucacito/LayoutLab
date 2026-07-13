// Elementor widget types with a dedicated converter in the E→D5 plugin.
// Source of truth: registerWidget() calls in
// jhmg-elementor-to-divi5/plugin/jhmg-converter-for-elementor-to-divi/
//   includes/converter/registry/class-converter-registry.php
// Regenerate with the grep in docs/superpowers/plans/2026-07-12-marketing-redesign.md (Task 1).

export type WidgetMappingGroup = { group: string; widgets: string[] };

export const WIDGET_MAPPING_GROUPS: WidgetMappingGroup[] = [
  {
    group: 'Elementor core',
    widgets: [
      'accordion', 'alert', 'animated-headline', 'audio', 'button', 'call-to-action',
      'countdown', 'counter', 'divider', 'flip-box', 'form', 'gallery', 'google-maps',
      'heading', 'hotspot', 'html', 'icon', 'icon-box', 'icon-list', 'image', 'image-box',
      'image-carousel', 'lottie', 'menu-anchor', 'nav-menu', 'page-title', 'portfolio',
      'posts', 'price-list', 'price-table', 'progress-bar', 'search', 'shortcode',
      'sidebar', 'site-logo', 'slides', 'social-icons', 'spacer', 'star-rating',
      'table-of-contents', 'tabs', 'testimonial', 'text-editor', 'text-path', 'toggle',
      'video',
    ],
  },
  {
    group: 'Elementor v4 atomic (e-*)',
    widgets: [
      'e-accordion', 'e-button', 'e-divider', 'e-heading', 'e-icon', 'e-icon-box',
      'e-image', 'e-image-box', 'e-paragraph', 'e-spacer', 'e-tabs', 'e-toggle',
    ],
  },
  {
    group: 'Essential Addons (eael-*)',
    widgets: [
      'eael-adv-accordion', 'eael-adv-tabs', 'eael-advanced-data-table', 'eael-breadcrumbs',
      'eael-caldera-form', 'eael-code-snippet', 'eael-contact-form-7', 'eael-content-ticker',
      'eael-countdown', 'eael-creative-button', 'eael-cta-box', 'eael-data-table',
      'eael-dual-color-header', 'eael-embedpress', 'eael-event-calendar', 'eael-fancy-text',
      'eael-feature-list', 'eael-filterable-gallery', 'eael-flip-box', 'eael-fluentform',
      'eael-gravity-form', 'eael-image-accordion', 'eael-info-box', 'eael-interactive-circle',
      'eael-login-register', 'eael-ninja', 'eael-post-grid', 'eael-post-timeline',
      'eael-pricing-table', 'eael-progress-bar', 'eael-simple-menu', 'eael-sticky-video',
      'eael-team-member', 'eael-testimonial', 'eael-tooltip', 'eael-weform',
      'eael-woo-add-to-cart', 'eael-woo-cart', 'eael-woo-checkout', 'eael-woo-product-carousel',
      'eael-woo-product-compare', 'eael-woo-product-gallery', 'eael-woo-product-images',
      'eael-woo-product-list', 'eael-woo-product-price', 'eael-woo-product-rating',
      'eael-wpforms',
    ],
  },
  {
    group: 'ElementsKit',
    widgets: [
      'elementskit-accordion', 'elementskit-dual-button', 'elementskit-heading',
      'elementskit-testimonial', 'elementskit-video',
    ],
  },
  {
    group: 'Header Footer Elementor (hfe-*)',
    widgets: [
      'hfe-basic-posts', 'hfe-breadcrumbs-widget', 'hfe-cart', 'hfe-counter',
      'hfe-search-button', 'hfe-site-tagline', 'hfe-site-title',
    ],
  },
  {
    group: 'Other add-ons',
    widgets: [
      'copyright', 'infocard', 'navigation-menu', 'post-info-widget',
      'premium-addon-blog', 'retina', 'woo-product-grid',
    ],
  },
];

export const WIDGET_TYPES_MAPPED = WIDGET_MAPPING_GROUPS.reduce((n, g) => n + g.widgets.length, 0);
