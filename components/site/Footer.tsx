import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Wordmark } from '@/components/ui/Wordmark';
import { Icon } from '@/components/ui/Icon';
import { AXIS_VALUES } from '@/lib/catalog/filters';
import { TYPE_LABELS, NICHE_LABELS } from '@/lib/nav/menu-data';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Plugins',
    links: [
      { href: '/plugins', label: 'All plugins' },
      { href: '/plugins/divi-5-ai-editor', label: 'Divi 5 AI Editor' },
      { href: '/plugins/elementor-to-divi-5', label: 'Elementor to Divi 5' },
      { href: '/plugins/divi-to-elementor', label: 'Divi to Elementor' },
    ],
  },
  {
    title: 'Layouts/Sections',
    links: AXIS_VALUES.type.slice(0, 7).map((v) => ({ href: `/type/${v}`, label: TYPE_LABELS[v] ?? cap(v) })),
  },
  {
    title: 'Themes/Packs',
    links: [
      { href: '/packs', label: 'All themes & packs' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'Industries',
    links: AXIS_VALUES.niche.slice(0, 7).map((v) => ({ href: `/niche/${v}`, label: NICHE_LABELS[v] ?? cap(v) })),
  },
  {
    title: 'Company',
    links: [
      { href: '/browse', label: 'Browse all' },
      { href: '/packs', label: 'Themes & Packs' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
      { href: '/license', label: 'License' },
    ],
  },
];

const TRUST = ['Validated Divi 5', 'Commercial license', 'Instant download'];

export function Footer() {
  return (
    <footer className="canvas-deep relative overflow-hidden text-paper">
      {/* Same bloom vocabulary as the canvas sections, so the footer reads as the
          bottom of one continuous surface rather than a separate slab. */}
      <div aria-hidden className="absolute inset-0">
        <span className="bloom -left-24 top-0 h-96 w-96 bg-g-purple/30" />
        <span className="bloom -right-20 bottom-0 h-96 w-96 bg-g-pink/20" />
      </div>

      <Container className="relative grid grid-cols-2 gap-x-8 gap-y-12 py-20 md:grid-cols-7">
        {/* Brand */}
        <div className="col-span-2">
          <Wordmark inverted />
          <p className="mt-4 max-w-xs text-small text-paper/70">
            Free, validated Divi 5 layouts and migration plugins for WordPress builders.
          </p>
          <ul className="mt-6 space-y-2">
            {TRUST.map((t) => (
              <li key={t} className="flex items-center gap-2 text-small text-paper/80">
                <Icon name="check_circle" size={16} className="text-g-pink" /> {t}
              </li>
            ))}
          </ul>
          <a
            href="mailto:support@divi5lab.com"
            className="mt-6 inline-flex items-center gap-2 rounded-pill border border-paper/25 bg-paper/10 px-4 py-2 text-small text-paper/90 backdrop-blur transition hover:border-paper/60 hover:bg-paper/20"
          >
            <Icon name="mail" size={16} /> support@divi5lab.com
          </a>
        </div>

        {/* Category columns */}
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <div className="eyebrow-tight text-paper/55">{c.title}</div>
            <ul className="mt-4 space-y-2.5">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-small text-paper/75 transition hover:text-paper">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>

      <div className="relative border-t border-paper/15">
        <Container className="py-7">
          <p className="max-w-4xl text-[12px] leading-relaxed text-paper/70">
            Divi is a registered trademark of Elegant Themes, Inc. This website is not affiliated with, nor endorsed by,
            Elegant Themes. Divi5Lab is run by a third party and is not associated with, nor acting on behalf of, Elegant Themes.
          </p>
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-small text-paper/80">© {new Date().getFullYear()} Divi5Lab. All rights reserved.</p>
            {/* Colour set per-link: the global `a { color: action }` base rule
                beats an inherited colour on the wrapper. */}
            <div className="flex items-center gap-6 text-small">
              <Link href="/license" className="text-paper/80 transition hover:text-paper">Terms</Link>
              <Link href="/license" className="text-paper/80 transition hover:text-paper">Privacy</Link>
              <Link href="/license" className="text-paper/80 transition hover:text-paper">License</Link>
            </div>
          </div>
        </Container>
      </div>
    </footer>
  );
}
