// Where "get the free plugin" points for each converter. A plugin still under
// wordpress.org review is served as a direct download of the exact zip that was
// submitted; once the listing is approved, swap its entry to the wordpress.org
// URL with `download: false` and delete the zip from public/downloads/.
export type FreePluginProduct = 'elementor-to-divi5' | 'beaver-to-divi5' | 'wpbakery-to-divi5' | 'divi-to-elementor';

export type FreePluginLink = {
  href: string;
  /** true: a zip served from this site (add the `download` attribute); false: the wordpress.org listing. */
  download: boolean;
  label: string;
};

const ZIP_LABEL = 'Download the free plugin (.zip)';
const WPORG_LABEL = 'Get the free plugin on wordpress.org';

export const FREE_PLUGIN_LINKS: Record<FreePluginProduct, FreePluginLink> = {
  'elementor-to-divi5': {
    href: 'https://wordpress.org/plugins/jhmg-converter-for-elementor-to-divi/',
    download: false,
    label: WPORG_LABEL,
  },
  'beaver-to-divi5': {
    href: '/downloads/jhmg-converter-for-beaver-builder-to-divi-5.zip',
    download: true,
    label: ZIP_LABEL,
  },
  'wpbakery-to-divi5': {
    href: '/downloads/jhmg-converter-for-wpbakery-to-divi.zip',
    download: true,
    label: ZIP_LABEL,
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
