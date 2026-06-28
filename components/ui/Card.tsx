import type { ReactNode } from 'react';

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-card border border-border bg-paper shadow-soft ${className}`}>{children}</div>;
}
