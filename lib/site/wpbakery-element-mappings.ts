// WPBakery element tags with a dedicated converter in the WPBakery→D5 plugin.
// Source of truth: `php scripts/element-coverage.php` in
// jhmg-wpbakery-to-divi5, which reads the plugin's own converter registry.
// At the 1.0.0 release commit it printed:
//   Registered WPBakery tags mapped   75 / 75   (38 exact, 31 approximate, 6 read by their parent element)
//   Template-only and vendor tags     23 / 23
//   Theme / add-on handlers shipped   31        (Ronneby x 23, Sliders x 2, Ultimate Addons x 6)
// The three add-on families are their own groups below, so 75 + 23 + 31 = 129
// tags with a handler. `rev_slider_vc` / `layerslider_vc` (WPBakery's own
// bridge tags, counted in the 23) and `rev_slider` / `layerslider` (the
// sliders' native tags, the Sliders family of 2) are four distinct tags.

export type ElementMappingGroup = {
  group: string;
  /** True for the groups that make up the 75 tags WPBakery itself registers. */
  registered: boolean;
  elements: string[];
};

export const WPBAKERY_ELEMENT_GROUPS: ElementMappingGroup[] = [
  {
    group: 'WPBakery structure',
    registered: true,
    elements: [
      'vc_section', 'vc_row', 'vc_row_inner', 'vc_column', 'vc_column_inner',
      'vc_flexbox_container', 'vc_flexbox_container_item', 'vc_grid_container',
      'vc_grid_container_item',
    ],
  },
  {
    group: 'WPBakery content',
    registered: true,
    elements: [
      'vc_basic_grid', 'vc_btn', 'vc_column_text', 'vc_copyright', 'vc_cta',
      'vc_custom_heading', 'vc_empty_space', 'vc_facebook', 'vc_flickr', 'vc_gallery',
      'vc_gmaps', 'vc_goo_maps', 'vc_googleplus', 'vc_hoverbox', 'vc_icon',
      'vc_images_carousel', 'vc_line_chart', 'vc_masonry_grid', 'vc_masonry_media_grid',
      'vc_media_grid', 'vc_message', 'vc_pie', 'vc_pinterest', 'vc_posts_slider',
      'vc_pricing_table', 'vc_progress_bar', 'vc_raw_html', 'vc_raw_js', 'vc_round_chart',
      'vc_separator', 'vc_single_image', 'vc_text_separator', 'vc_toggle',
      'vc_tta_accordion', 'vc_tta_pageable', 'vc_tta_section', 'vc_tta_tabs',
      'vc_tta_toggle', 'vc_tta_toggle_section', 'vc_tta_tour', 'vc_tweetmeme',
      'vc_video', 'vc_zigzag',
    ],
  },
  {
    group: 'WordPress widgets',
    registered: true,
    elements: [
      'vc_widget_sidebar', 'vc_wp_archives', 'vc_wp_calendar', 'vc_wp_categories',
      'vc_wp_custommenu', 'vc_wp_links', 'vc_wp_meta', 'vc_wp_pages', 'vc_wp_posts',
      'vc_wp_recentcomments', 'vc_wp_rss', 'vc_wp_search', 'vc_wp_tagcloud', 'vc_wp_text',
    ],
  },
  {
    group: 'Deprecated elements',
    registered: true,
    elements: [
      'vc_button', 'vc_button2', 'vc_cta_button', 'vc_cta_button2', 'vc_tabs', 'vc_tab',
      'vc_tour', 'vc_accordion', 'vc_accordion_tab',
    ],
  },
  {
    group: 'Template-only and vendor tags',
    registered: false,
    elements: [
      'vc_gutenberg', 'vc_custom_field', 'rev_slider_vc', 'layerslider_vc', 'contact-form-7',
      'woocommerce_cart', 'woocommerce_checkout', 'woocommerce_order_tracking',
      'woocommerce_my_account', 'recent_products', 'featured_products', 'product', 'products',
      'add_to_cart', 'add_to_cart_url', 'product_page', 'product_category',
      'product_categories', 'sale_products', 'best_selling_products', 'top_rated_products',
      'product_attribute', 'related_products',
    ],
  },
  {
    group: 'Ultimate Addons for WPBakery',
    registered: false,
    elements: [
      'bsf-info-box', 'just_icon', 'stat_counter', 'ult_content_box', 'ultimate_pricing',
      'ultimate_video',
    ],
  },
  {
    group: 'Sliders',
    registered: false,
    // The sliders' own tags. WPBakery's bridge tags for the same two decks,
    // `rev_slider_vc` and `layerslider_vc`, are in the template-only group.
    elements: ['rev_slider', 'layerslider'],
  },
  {
    group: 'Ronneby (DFD)',
    registered: false,
    elements: [
      'announcement', 'countdown', 'dfd_accordion', 'dfd_blog_posts', 'dfd_button',
      'dfd_delimiter', 'dfd_google_map', 'dfd_heading', 'dfd_icon_list', 'dfd_icon_list_item',
      'dfd_info_box', 'dfd_new_social_accounts', 'dfd_single_image', 'dfd_spacer',
      'dfd_tta_tabs', 'dfd_tta_tour', 'facts', 'info_banner', 'new_team_member',
      'new_testimonials', 'piecharts', 'progressbar', 'videoplayer',
    ],
  },
];

/** Tags WPBakery Page Builder itself registers (75 in 9.0.1), every one with a handler. */
export const WPBAKERY_REGISTERED_ELEMENTS = 75;

/** The coverage line the plugin readme quotes, verbatim, parenthetical and all. */
export const WPBAKERY_COVERAGE_PARENTHETICAL = '38 exact, 31 approximate, 6 read by their parent element';

export const WPBAKERY_ELEMENT_TYPES_MAPPED = WPBAKERY_ELEMENT_GROUPS.reduce(
  (n, g) => n + g.elements.length,
  0,
);
