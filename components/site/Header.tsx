import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Wordmark } from '@/components/ui/Wordmark';
import { MegaMenu } from './MegaMenu';
import { MobileNav } from './MobileNav';

const MOBILE_LINKS = [
  { href: '/browse', label: 'Browse' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/license', label: 'License' },
  { href: '/login', label: 'Sign in' },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur">
      <Container className="relative flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <Wordmark />
          <MegaMenu />
        </div>
        <div className="hidden items-center gap-4 md:flex">
          <Link href="/login" className="text-body font-medium text-navy transition hover:text-action">Sign in</Link>
          <Button href="/browse">Browse layouts</Button>
        </div>
        <MobileNav links={MOBILE_LINKS} />
      </Container>
    </header>
  );
}
