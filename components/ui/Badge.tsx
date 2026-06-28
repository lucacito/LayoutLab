import type { ReactNode } from 'react';

export function Badge({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-fog px-3 py-1 text-small font-medium text-navy">{children}</span>;
}
