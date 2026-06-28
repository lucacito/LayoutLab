import Link from 'next/link';
import type { ReactNode } from 'react';

const base = 'inline-flex h-12 items-center justify-center rounded-button px-6 text-base font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 disabled:opacity-40';
const variants = {
  primary: 'bg-action text-paper hover:brightness-110',
  secondary: 'bg-paper text-navy border border-border hover:bg-fog',
};

export function Button({
  variant = 'primary',
  href,
  className = '',
  children,
  ...rest
}: {
  variant?: 'primary' | 'secondary';
  href?: string;
  className?: string;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = `${base} ${variants[variant]} ${className}`;
  if (href) {
    return <Link href={href} className={cls}>{children}</Link>;
  }
  return <button className={cls} {...rest}>{children}</button>;
}
