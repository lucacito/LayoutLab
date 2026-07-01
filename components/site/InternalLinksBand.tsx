import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { hubLinkGroups } from '@/lib/seo/internal-links';

// Sitewide pre-footer internal-link band. Sculpts equity toward the money page
// (/browse) and the taxonomy hubs with keyword-rich anchors from every route.
// Uses plain labels (not headings) so it doesn't pollute each page's heading
// outline.
export function InternalLinksBand() {
  const groups = hubLinkGroups();
  return (
    <section className="border-t border-border bg-paper py-12" aria-label="Explore Divi 5 layouts">
      <Container>
        <p className="text-small text-muted">
          Explore{' '}
          <Link href="/browse" className="font-semibold text-navy transition hover:text-action">
            free Divi 5 layouts
          </Link>{' '}
          by type, industry and style.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {groups.map((g) => (
            <div key={g.heading}>
              <p className="text-small font-semibold text-navy">{g.heading}</p>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-small text-muted transition hover:text-action">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
