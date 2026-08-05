import type { ReactNode } from 'react';

const tones = {
  light: 'bg-fog text-navy',
  brand: 'bg-action/10 text-action',
  dark: 'bg-paper/15 text-paper backdrop-blur border border-paper/20',
};

export function Badge({
  tone = 'light',
  className = '',
  children,
}: {
  tone?: keyof typeof tones;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-small font-semibold ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
