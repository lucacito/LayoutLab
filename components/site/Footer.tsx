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
    <footer className="mt-24 border-t border-border bg-paper">
      <Container className="grid grid-cols-2 gap-x-8 gap-y-10 py-16 md:grid-cols-7">
        {/* Brand */}
        <div className="col-span-2">
          <Wordmark />
          <p className="mt-3 max-w-xs text-small text-muted">
            Free, validated Divi 5 layouts and migration plugins for WordPress builders.
          </p>
          <ul className="mt-5 space-y-1.5">
            {TRUST.map((t) => (
              <li key={t} className="flex items-center gap-2 text-small text-muted">
                <Icon name="check_circle" size={16} className="text-action" /> {t}
              </li>
            ))}
          </ul>
          <a href="mailto:support@divi5lab.com" className="mt-5 inline-flex items-center gap-2 text-small text-muted transition hover:text-action">
            <Icon name="mail" size={16} className="text-action" /> support@divi5lab.com
          </a>
        </div>

        {/* Category columns */}
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <div className="text-small font-semibold uppercase tracking-wide text-muted">{c.title}</div>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-small text-navy transition hover:text-action">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>

      <div className="border-t border-border">
        <Container className="py-6">
          <p className="max-w-4xl text-[12px] leading-relaxed text-muted">
            Divi is a registered trademark of Elegant Themes, Inc. This website is not affiliated with, nor endorsed by,
            Elegant Themes. Divi5Lab is run by a third party and is not associated with, nor acting on behalf of, Elegant Themes.
          </p>
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-small text-muted">© {new Date().getFullYear()} Divi5Lab. All rights reserved.</p>
            <div className="flex items-center gap-5 text-small text-muted">
              <Link href="/license" className="transition hover:text-action">Terms</Link>
              <Link href="/license" className="transition hover:text-action">Privacy</Link>
              <Link href="/license" className="transition hover:text-action">License</Link>
            </div>
          </div>
        </Container>
      </div>
    </footer>
  );
}
