import type { ReactNode } from 'react';

const tones = {
  /** Default light card, for paper/mist sections. */
  paper: 'border-border bg-paper shadow-soft',
  /** Frosted card for use on top of the immersive canvas. */
  glass: 'border-paper/15 bg-paper/10 backdrop-blur-md shadow-float',
  /** Deep card: inverts against a light section. */
  deep: 'border-navy/40 bg-navy shadow-float',
};

export function Card({
  tone = 'paper',
  className = '',
  children,
}: {
  tone?: keyof typeof tones;
  className?: string;
  children: ReactNode;
}) {
  return <div className={`rounded-card border ${tones[tone]} ${className}`}>{children}</div>;
}
