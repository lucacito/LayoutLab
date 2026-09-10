// Beaver Builder module types with a dedicated converter in the BB→D5 plugin.
// Source of truth: tests/DocumentedModulesTest.php (Beaver Builder's own module
// reference, docs.wpbeaverbuilder.com → Layouts → Modules) plus the add-on
// handlers in includes/converter/handlers/ of
// jhmg-beaver-to-divi5/plugin/jhmg-converter-for-beaver-builder-to-divi-5/.

export type ModuleMappingGroup = { group: string; modules: string[] };

export const BEAVER_MODULE_GROUPS: ModuleMappingGroup[] = [
  {
    group: 'Beaver Builder Lite',
    modules: [
      'Heading', 'Text Editor', 'Photo', 'Button', 'Button Group', 'HTML', 'Video', 'Audio',
      'Sidebar', 'Icon', 'Callout', 'Call to Action', 'Number Counter', 'Star Rating', 'Menu',
      'Box', 'Widgets', 'WordPress Patterns', 'ACF Blocks',
    ],
  },
  {
    group: 'Beaver Builder Pro',
    modules: [
      'Separator', 'Accordion', 'Tabs', 'Testimonials', 'Pricing Table', 'Contact Form',
      'Subscribe Form', 'Map', 'Gallery', 'Slideshow', 'Content Slider', 'Posts', 'Posts Slider',
      'Posts Carousel', 'Countdown', 'Icon Group', 'Social Buttons', 'Login Form', 'Search',
      'List', 'Progress Bar', 'WooCommerce', 'BigCommerce Products', 'North Commerce',
    ],
  },
  {
    group: 'Beaver Themer',
    modules: ['Loop', 'Popup', 'Field connections (post, author, site, custom fields, ACF)'],
  },
  {
    group: 'PowerPack for Beaver Builder',
    modules: ['Advanced Heading', 'Icon List', 'Fluent Forms'],
  },
];

/** Modules in Beaver Builder's own module reference (44 in the 2.11 list), every one with a handler. */
export const BEAVER_REFERENCE_MODULES = 44;

export const BEAVER_MODULE_TYPES_MAPPED = BEAVER_MODULE_GROUPS.reduce((n, g) => n + g.modules.length, 0);
