import type { ReactNode } from 'react';

export function SectionTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && <div className="mb-3 text-small font-semibold uppercase tracking-wide text-action">{eyebrow}</div>}
      <h2 className="text-h2 text-navy">{title}</h2>
      {children && <p className="mt-4 text-lead text-muted">{children}</p>}
    </div>
  );
}
