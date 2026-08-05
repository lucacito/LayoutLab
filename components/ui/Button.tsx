import Link from 'next/link';
import type { ReactNode } from 'react';

const base =
  'inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 disabled:opacity-40';

const sizes = {
  sm: 'h-10 px-5 text-small',
  md: 'h-12 px-7 text-body',
  lg: 'h-14 px-9 text-body',
};

const variants = {
  /** Filled brand button. The glow is what makes it read as a CTA, not a chip. */
  primary: 'bg-action text-paper shadow-glow hover:-translate-y-0.5 hover:shadow-glow-lg hover:brightness-110',
  /** Light surfaces: outlined, leans toward brand on hover. */
  secondary: 'bg-paper text-navy border border-border hover:-translate-y-0.5 hover:border-action hover:text-action hover:shadow-lift',
  /** On the immersive canvas: translucent white over the gradient. */
  onDark: 'bg-paper/10 text-paper border border-paper/35 backdrop-blur hover:-translate-y-0.5 hover:bg-paper/20 hover:border-paper/70',
  /** Text-only, arrow-style link button. */
  ghost: 'text-action hover:text-navy',
};

export function Button({
  variant = 'primary',
  size = 'sm',
  href,
  className = '',
  children,
  ...rest
}: {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  href?: string;
  className?: string;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = `${base} ${variant === 'ghost' ? '' : sizes[size]} ${variants[variant]} ${className}`;
  if (href) {
    return <Link href={href} className={cls}>{children}</Link>;
  }
  return <button className={cls} {...rest}>{children}</button>;
}
