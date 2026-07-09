import { axisLabel } from './taxonomy-copy';

// Descriptive, keyword-bearing alt text for layout screenshots. Google Images
// reads alt + filename; bare titles ("Skyline Hero") say nothing about what the
// image shows or the product space ("SaaS Hero layout built with Divi 5" does).
export function layoutAltText(l: { title: string; type?: string | null; niche?: string | null }): string {
  const axes = [l.niche, l.type].filter((v): v is string => Boolean(v)).map(axisLabel).join(' ');
  return axes ? `${l.title} — ${axes} layout built with Divi 5` : `${l.title} — layout built with Divi 5`;
}
