import type { ReactNode } from 'react';
import { Eyebrow } from './Eyebrow';

export function SectionTitle({
  eyebrow,
  title,
  tone = 'light',
  className = '',
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  /** `dark` = sitting on the immersive canvas. */
  tone?: 'light' | 'dark';
  className?: string;
  children?: ReactNode;
}) {
  const dark = tone === 'dark';
  return (
    <div className={`mx-auto max-w-3xl text-center ${className}`}>
      {eyebrow && <Eyebrow tone={dark ? 'dark' : 'light'} className="mb-4">{eyebrow}</Eyebrow>}
      <h2 className={`text-h2 ${dark ? 'text-paper' : 'text-navy'}`}>{title}</h2>
      {children && <p className={`mx-auto mt-5 max-w-2xl text-lead ${dark ? 'text-paper/80' : 'text-muted'}`}>{children}</p>}
    </div>
  );
}
