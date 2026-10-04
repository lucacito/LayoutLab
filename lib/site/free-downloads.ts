// Where "get the free plugin" points for each converter. Every listing is
// approved, so each entry is its wordpress.org URL. A plugin still under review
// would be served as a direct download of the exact zip that was submitted
// (`download: true`, a zip in public/downloads/) until its listing is approved.
export type FreePluginProduct = 'elementor-to-divi5' | 'beaver-to-divi5' | 'wpbakery-to-divi5' | 'divi-to-elementor' | 'ai-editor-divi5';

export type FreePluginLink = {
  href: string;
  /** true: a zip served from this site (add the `download` attribute); false: the wordpress.org listing. */
  download: boolean;
  label: string;
};

const WPORG_LABEL = 'Get the free plugin on wordpress.org';

export const FREE_PLUGIN_LINKS: Record<FreePluginProduct, FreePluginLink> = {
  // JHMG AI Editor for Divi 5 is approved and published on wordpress.org (2026-10-04); that listing is the only place
  // to get it, so the version is always current. (An old 4.0.0 zip was served from public/downloads/ while the
  // review was pending: it is too old for the Pro add-on, which needs 4.4.0 or newer, and has been removed.)
  'ai-editor-divi5': {
    href: 'https://wordpress.org/plugins/jhmg-ai-editor-for-divi-5/',
    download: false,
    label: WPORG_LABEL,
  },
  'elementor-to-divi5': {
    href: 'https://wordpress.org/plugins/jhmg-converter-for-elementor-to-divi/',
    download: false,
    label: WPORG_LABEL,
  },
  'beaver-to-divi5': {
    href: 'https://wordpress.org/plugins/jhmg-converter-for-beaver-builder-to-divi-5/',
    download: false,
    label: WPORG_LABEL,
  },
  'wpbakery-to-divi5': {
    href: 'https://wordpress.org/plugins/jhmg-converter-for-wpbakery-to-divi-5/',
    download: false,
    label: WPORG_LABEL,
  },
  'divi-to-elementor': {
    href: 'https://wordpress.org/plugins/jhmg-converter-for-divi-to-elementor/',
    download: false,
    label: WPORG_LABEL,
  },
};

/** Anchor attributes for a free-plugin link: `download` for a zip, a new tab for wordpress.org. */
export function freePluginAnchorProps(link: FreePluginLink): { download?: boolean; target?: string; rel?: string } {
  return link.download ? { download: true } : { target: '_blank', rel: 'noopener noreferrer' };
}
