import Link from 'next/link';
import { Container } from '@/components/ui/Container';

const COLS = [
  { title: 'Catalog', links: [{ href: '/browse', label: 'Browse' }, { href: '/pricing', label: 'Pricing' }] },
  { title: 'Company', links: [{ href: '/about', label: 'About' }] },
  { title: 'Legal', links: [{ href: '/license', label: 'License' }] },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-paper">
      <Container className="grid grid-cols-2 gap-8 py-16 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <div className="text-xl font-bold text-navy">LayoutLab</div>
          <p className="mt-2 text-small text-muted">Validated, import-ready Divi 5 layouts.</p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <div className="text-small font-semibold uppercase tracking-wide text-muted">{c.title}</div>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.href}><Link href={l.href} className="text-body text-navy hover:text-action">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
      <Container className="border-t border-border py-6">
        <p className="text-small text-muted">© 2026. All rights reserved.</p>
      </Container>
    </footer>
  );
}
