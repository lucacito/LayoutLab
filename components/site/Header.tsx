'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Wordmark } from '@/components/ui/Wordmark';
import { PrimaryNav } from './PrimaryNav';
import { MobileNav } from './MobileNav';
import { AccountNav } from './AccountNav';

/**
 * Routes whose first section is an immersive canvas hero (`SectionShell`
 * tone="hero" / `PageHero`). On those the header floats transparently over the
 * gradient until the user scrolls, then solidifies. Everywhere else (catalog,
 * account, admin, guide detail) it is solid from the start.
 *
 * Keep this in sync when a page gains or loses a canvas hero.
 */
const CANVAS_HERO_ROUTES = new Set(['/', '/plugins', '/pricing', '/about', '/contact', '/guides']);
const hasCanvasHero = (pathname: string) =>
  CANVAS_HERO_ROUTES.has(pathname) || pathname.startsWith('/plugins/');

export function Header() {
  const pathname = usePathname();
  const overHero = hasCanvasHero(pathname ?? '');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!overHero) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overHero]);

  const floating = overHero && !scrolled;

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-300 ${
        floating ? 'bg-transparent' : 'border-b border-border bg-paper/90 shadow-soft backdrop-blur'
      }`}
    >
      <Container className="relative flex h-20 items-center justify-between gap-6">
        <Wordmark inverted={floating} />

        {/* Centered funnel navigation */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">
          <PrimaryNav inverted={floating} />
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <AccountNav inverted={floating} />
          <Button href="/pricing" size="sm" variant={floating ? 'onDark' : 'primary'}>
            Get Pro
          </Button>
        </div>

        <MobileNav inverted={floating} />
      </Container>
    </header>
  );
}
