import type { CSSProperties, ReactNode } from 'react';

/**
 * Layered product-panel motif: a main panel in flow (so it sets the height)
 * with satellite panels floating over its corners. Satellites are hidden below
 * `lg` — at phone widths they would overlap the main panel's content rather
 * than framing it.
 *
 * The gentle float is staggered per layer so the group never moves in lockstep;
 * `prefers-reduced-motion` disables it via the global guard.
 */
export function FloatingStack({
  main,
  left,
  right,
  className = '',
}: {
  main: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <div className="relative z-10 animate-float [animation-delay:-1s] drop-shadow-[0_40px_80px_rgba(11,53,88,.45)]">{main}</div>

      {/* Satellites sit almost entirely outside the main panel — they should
          frame it, not cover its content. */}
      {left && (
        <div
          aria-hidden
          className="pointer-events-none absolute -left-52 -bottom-10 z-20 hidden w-56 animate-float lg:block"
          style={{ animationDelay: '-3.2s' } as CSSProperties}
        >
          {left}
        </div>
      )}

      {right && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-48 -top-14 z-0 hidden w-56 animate-float lg:block"
          style={{ animationDelay: '-5s' } as CSSProperties}
        >
          {right}
        </div>
      )}
    </div>
  );
}
