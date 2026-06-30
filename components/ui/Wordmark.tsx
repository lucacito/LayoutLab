import Link from 'next/link';
import Image from 'next/image';

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <Link href="/" aria-label="Divi5Lab home" className={`inline-flex items-center ${className}`}>
      <Image src="/divi5lab-logo.png" alt="Divi5Lab" width={350} height={70} priority className="h-8 w-auto" />
    </Link>
  );
}
