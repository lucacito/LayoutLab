import Link from 'next/link';
import Image from 'next/image';

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <Link href="/" aria-label="Divi5Lab home" className={`inline-flex items-center ${className}`}>
      <Image src="/divi5lab-logo-dark.png" alt="Divi5Lab" width={500} height={93} priority className="h-8 w-auto" />
    </Link>
  );
}
