import Link from 'next/link';
import Image from 'next/image';

export function Wordmark({ inverted = false, className = '' }: { inverted?: boolean; className?: string }) {
  return (
    <Link href="/" aria-label="Divi5Lab home" className={`inline-flex items-center ${className}`}>
      <Image
        // Light variant keeps the violet "5" and flask; only the neutral ink
        // is flipped to white, so the mark stays on-brand over the canvas.
        src={inverted ? '/divi5lab-logo-light.png' : '/divi5lab-logo-dark.png'}
        alt="Divi5Lab"
        width={500}
        height={93}
        priority
        className="h-9 w-auto"
      />
    </Link>
  );
}
