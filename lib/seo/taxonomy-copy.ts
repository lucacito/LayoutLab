import type { TaxonomyAxis, TaxonomyCopy } from './taxonomy';

export function axisLabel(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function axisNoun(axis: TaxonomyAxis): string {
  switch (axis) {
    case 'type': return 'section';
    case 'niche': return 'industry';
    case 'style': return 'style';
    case 'color': return 'color';
  }
}

export function taxonomyFallbackCopy(axis: TaxonomyAxis, value: string, count: number): TaxonomyCopy {
  const label = axisLabel(value);
  const noun = axisNoun(axis);
  const countPhrase = count > 0 ? `${count} ` : '';
  const intro = axis === 'type'
    ? `Browse ${countPhrase}professionally designed ${label} layouts for Divi 5. Import the JSON, customize in the builder, and ship faster.`
    : axis === 'niche'
      ? `Divi 5 layouts crafted for the ${label} industry — ${countPhrase}ready-to-import sections you can make your own in minutes.`
      : axis === 'style'
        ? `Explore ${countPhrase}${label.toLowerCase()} Divi 5 layouts. A curated ${label} aesthetic, ready to import and customize.`
        : `Divi 5 layouts in ${label.toLowerCase()} — ${countPhrase}designs built around a ${label.toLowerCase()} palette, ready to import.`;
  const metaTitle = `${label} Divi 5 Layouts${axis === 'type' ? '' : ` (${noun})`} — LayoutLab`;
  const metaDescription = `Download ${countPhrase}${label} Divi 5 layouts as JSON. Import, customize, and launch. Commercial license included.`;
  return { intro, metaTitle, metaDescription };
}
