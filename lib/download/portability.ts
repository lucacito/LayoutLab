/**
 * Divi's own importer (Portability > Import, POST /divi/v1/portability/import) refuses any file without a
 * `context` key: "This file should not be imported in this context." The store keeps every layout as the bare
 * `{ post_title, post_content }` pair, so the file is wrapped in the shape Divi's exporter writes at delivery.
 * Verified on Divi 5.15.1: the bare file gets a 400, the wrapped one a 200 with the layout content.
 *
 * Anything that is not a bare layout (invalid JSON, no string `post_content`, already has a `context`) is returned
 * unchanged, so this is safe to run on every download and never wraps twice.
 */
export interface PortabilityExtras {
  /** Divi global colors as Divi's exporter writes them: a list of [ 'gcid-…', { color, label, status } ] pairs. */
  globalColors?: [string, { color: string; label?: string; status?: 'active' | 'inactive' }][];
  /** Divi module presets as Divi's exporter writes them: { module: { 'divi/text': { default, items } }, group: [] }. */
  presets?: object;
}

export function toDiviPortability(json: string, extras: PortabilityExtras = {}): string {
  let layout: unknown;
  try {
    layout = JSON.parse(json);
  } catch {
    return json;
  }
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) return json;
  const l = layout as Record<string, unknown>;
  if ('context' in l || typeof l.post_content !== 'string') return json;
  return JSON.stringify({
    context: 'et_builder',
    data: { '1': { post_title: typeof l.post_title === 'string' ? l.post_title : '', post_content: l.post_content } },
    presets: extras.presets ?? '',
    global_colors: extras.globalColors ?? '',
    global_variables: '',
    images: [],
    thumbnails: [],
  });
}
