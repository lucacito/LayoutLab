import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Wordmark } from '@/components/ui/Wordmark';
import { MegaMenu } from './MegaMenu';
import { MobileNav } from './MobileNav';
import { AccountNav } from './AccountNav';
import { SavedLink } from '@/components/bookmarks/SavedLink';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur">
      <Container className="relative flex h-16 items-center justify-between gap-6">
        <Wordmark />
        {/* Centered main navigation */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">
          <MegaMenu />
        </div>
        <div className="hidden items-center gap-4 md:flex">
          <SavedLink />
          <AccountNav />
          <Button href="/browse">Browse layouts</Button>
        </div>
        <MobileNav />
      </Container>
    </header>
  );
}
