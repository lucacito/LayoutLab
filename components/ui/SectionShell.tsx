import type { CSSProperties, ReactNode } from 'react';

const tones = {
  paper: 'bg-paper text-ink',
  mist: 'canvas-mist text-ink',
  deep: 'canvas-deep text-paper',
  hero: 'canvas-hero text-paper',
};

// Top and bottom are independent so a section can, say, open tight under the
// header and still leave room for content that floats over the next seam.
const padTop = {
  none: '',
  sm: 'pt-14',
  md: 'pt-20 md:pt-24',
  lg: 'pt-24 md:pt-32',
  xl: 'pt-32 md:pt-40',
};
const padBottom = {
  none: '',
  sm: 'pb-14',
  md: 'pb-20 md:pb-24',
  lg: 'pb-24 md:pb-32',
  xl: 'pb-32 md:pb-44',
};

/**
 * The edge colour of each tone, for callers wiring up curved transitions.
 * A curve is painted in the *neighbouring* band's colour, so a section
 * following `canvas-deep` gets `curveTop={EDGE.deepBottom}`.
 */
export const EDGE = {
  paper: '#FFFFFF',
  mist: '#F8F9FB',
  deepTop: '#0B3558',
  deepBottom: '#635BFF',
} as const;

/**
 * Owns section rhythm: ground tone, vertical padding, curved seams, and the
 * decorative blooms that keep the canvas from reading as a flat colour fill.
 */
export function SectionShell({
  tone = 'paper',
  pad = 'md',
  top,
  bottom,
  underHeader = false,
  curveTop,
  curveBottom,
  blooms = false,
  id,
  className = '',
  children,
}: {
  tone?: keyof typeof tones;
  /** Shorthand for both edges; `top`/`bottom` override it individually. */
  pad?: keyof typeof padTop;
  top?: keyof typeof padTop;
  bottom?: keyof typeof padBottom;
  /**
   * Pull the section up behind the sticky header (h-20), so a transparent
   * header floats over this section's ground instead of over the page
   * background. Only for a page's first section.
   */
  underHeader?: boolean;
  /** Colour of the band above, painted as a downward curve into this one. */
  curveTop?: string;
  /** Colour of the band below, painted as an upward curve into this one. */
  curveBottom?: string;
  /** Render soft blurred colour blooms behind the content. */
  blooms?: boolean;
  /** Anchor target for in-page links. */
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const curveClass = `${curveTop ? 'curve-top ' : ''}${curveBottom ? 'curve-bottom' : ''}`.trim();
  // Both pseudo-elements read the same custom property, so a section may use one
  // curve or the other, not two different colours at once.
  const style = { '--curve-color': curveTop ?? curveBottom } as CSSProperties;

  const pt = padTop[top ?? (underHeader ? 'xl' : pad)];
  const pb = padBottom[bottom ?? pad];

  return (
    <section
      id={id}
      className={`relative overflow-hidden ${tones[tone]} ${underHeader ? '-mt-20' : ''} ${pt} ${pb} ${curveClass} ${className}`}
      style={curveClass ? style : undefined}
    >
      {blooms && (
        <div aria-hidden className="absolute inset-0 -z-0">
          <span className="bloom -left-32 top-[-10%] h-96 w-96 bg-g-purple/35" />
          <span className="bloom -right-24 bottom-[-15%] h-[28rem] w-[28rem] bg-g-pink/25" />
        </div>
      )}
      <div className="relative z-10">{children}</div>
    </section>
  );
}
