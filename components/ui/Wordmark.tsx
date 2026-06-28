import Link from 'next/link';

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`text-xl font-bold tracking-tight text-navy ${className}`}>
      LayoutLab
    </Link>
  );
}
