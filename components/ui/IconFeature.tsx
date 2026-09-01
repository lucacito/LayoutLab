import type { ReactNode } from 'react';

/** Circular tinted icon puck + title + body: the feature-grid unit. */
export function IconFeature({
  icon,
  title,
  body,
  tone = 'light',
  className = '',
}: {
  icon: ReactNode;
  title: string;
  body: string;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const dark = tone === 'dark';
  return (
    <div className={className}>
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-pill ${
          dark ? 'bg-paper/10 text-paper ring-1 ring-inset ring-paper/20' : 'bg-action/10 text-action'
        }`}
      >
        {icon}
      </div>
      <h3 className={`mt-5 text-section ${dark ? 'text-paper' : 'text-navy'}`}>{title}</h3>
      <p className={`mt-2 text-body ${dark ? 'text-paper/75' : 'text-muted'}`}>{body}</p>
    </div>
  );
}
