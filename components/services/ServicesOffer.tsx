import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Icon } from '@/components/ui/Icon';

// Starting prices — adjust freely; every project still gets a fixed quote up front.
const TIERS: { name: string; price: string; icon: string; blurb: string; points: string[]; featured?: boolean }[] = [
  {
    name: 'Landing Page',
    price: 'from $299',
    icon: 'ads_click',
    blurb: 'A single high-converting page — hero, services, trust and a quote form built to make the phone ring.',
    points: ['Mobile-first design', 'Click-to-call button', 'Quote / estimate form', '~3-day delivery'],
  },
  {
    name: 'Full Website',
    price: 'from $899',
    icon: 'web',
    blurb: 'A complete multi-page site: home, services, service areas, about, reviews and contact — all conversion-tuned.',
    points: ['5–7 pages', 'Per-service pages', 'Local-SEO ready', 'Live in about a week'],
    featured: true,
  },
  {
    name: 'Site Refresh',
    price: 'from $199',
    icon: 'auto_fix_high',
    blurb: 'Keep your content, lose the dated look. We rebuild your existing site in modern Divi 5.',
    points: ['Modern redesign', 'Faster load', 'Mobile fixes', 'Quick turnaround'],
  },
];

export function ServicesOffer() {
  return (
    <section className="py-16">
      <Container>
        <SectionTitle eyebrow="What we build" title="A site built to bring in work — not just look nice">
          Most trades sites are online brochures. We build the version that turns visitors into booked jobs.
        </SectionTitle>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TIERS.map((t) => (
            <div key={t.name} className={`flex flex-col rounded-card border p-7 ${t.featured ? 'border-action bg-mist shadow-soft' : 'border-border bg-paper'}`}>
              <span className="flex h-11 w-11 items-center justify-center rounded-button bg-action/10 text-action">
                <Icon name={t.icon} size={22} />
              </span>
              <h3 className="mt-4 text-h3 text-navy">{t.name}</h3>
              <p className="mt-1 text-lead font-semibold text-action">{t.price}</p>
              <p className="mt-3 text-body text-muted">{t.blurb}</p>
              <ul className="mt-5 space-y-2">
                {t.points.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-small text-navy">
                    <Icon name="check_circle" size={16} className="text-action" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="text-small text-muted">Prices are starting points — every project gets a fixed quote up front.</p>
          <Link href="/contact" className="inline-flex h-12 items-center justify-center rounded-full bg-action px-7 text-body font-semibold text-paper transition hover:brightness-110">
            Get a free quote
          </Link>
        </div>
      </Container>
    </section>
  );
}
