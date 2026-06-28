import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Wordmark } from '@/components/ui/Wordmark';
import { MobileNav } from './MobileNav';

const NAV = [
  { href: '/browse', label: 'Browse' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/license', label: 'License' },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur">
      <Container className="relative flex h-16 items-center justify-between">
        <Wordmark />
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((l) => (
            <Link key={l.href} href={l.href} className="text-body font-medium text-navy hover:text-action">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-4 md:flex">
          <Link href="/login" className="text-body font-medium text-navy hover:text-action">Sign in</Link>
          <Button href="/browse">Browse layouts</Button>
        </div>
        <MobileNav links={[...NAV, { href: '/login', label: 'Sign in' }]} />
      </Container>
    </header>
  );
}
