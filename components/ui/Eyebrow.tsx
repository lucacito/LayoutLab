import type { ReactNode } from 'react';

const tones = {
  light: 'text-action',
  dark: 'text-g-pink',
  muted: 'text-muted',
};

/**
 * Uppercase tracked kicker that sits above a section headline. Every major
 * section gets one — the repetition is what establishes the rhythm.
 */
export function Eyebrow({
  tone = 'light',
  className = '',
  children,
}: {
  tone?: keyof typeof tones;
  className?: string;
  children: ReactNode;
}) {
  return <p className={`eyebrow ${tones[tone]} ${className}`}>{children}</p>;
}
