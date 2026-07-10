import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Wordmark } from '@/components/ui/Wordmark';
import { PrimaryNav } from './PrimaryNav';
import { MobileNav } from './MobileNav';
import { AccountNav } from './AccountNav';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur">
      <Container className="relative flex h-16 items-center justify-between gap-6">
        <Wordmark />
        {/* Centered funnel navigation */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">
          <PrimaryNav />
        </div>
        <div className="hidden items-center gap-4 md:flex">
          <AccountNav />
          <Button href="/contact">Get a free quote</Button>
        </div>
        <MobileNav />
      </Container>
    </header>
  );
}
