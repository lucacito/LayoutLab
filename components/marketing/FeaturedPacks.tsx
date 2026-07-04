import Link from 'next/link';
import type { PackRow } from '@/lib/catalog/queries';
import { formatPriceCents } from '@/lib/format/price';
import { Container } from '@/components/ui/Container';
import { PreviewImage } from '@/components/PreviewImage';
import { Icon } from '@/components/ui/Icon';

const BENEFITS = [
  'Every page shares one brand — voice, color and details all match',
  'Senior-level copy already written — no lorem ipsum, no "your content here"',
  'Deterministically validated & screenshot-perfect',
  'One commercial license — unlimited sites you own or build for clients',
];

function priceLabel(pack: PackRow): string {
  return pack.kind === 'free' ? 'Free' : pack.priceCents != null ? formatPriceCents(pack.priceCents) : '';
}

/**
 * Full-bleed promo band for premium multi-page "theme" packs. The first pack gets a
 * large split feature (cover shot + hard sell); any others render as compact promo
 * cards below. Scales from one pack to many without looking empty.
 */
export function FeaturedPacks({ packs }: { packs: PackRow[] }) {
  if (packs.length === 0) return null;
  const [hero, ...rest] = packs;
  const heroPrice = priceLabel(hero);

  return (
    <section className="relative isolate overflow-hidden bg-ink py-20 text-paper">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(55% 80% at 15% 0%, rgba(99,91,255,0.35), transparent), radial-gradient(50% 70% at 90% 100%, rgba(0,153,255,0.28), transparent), #07070B',
        }}
      />
      <Container>
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-paper/10 px-3 py-1 text-small font-semibold text-paper backdrop-blur">
            <Icon name="auto_awesome" size={16} className="text-action" /> Complete website themes
          </span>
          <h2 className="mt-4 text-h2 text-paper">Launch a whole site this afternoon — not next month.</h2>
          <p className="mt-3 text-lead text-paper/80">
            Premium multi-page Divi 5 packs where every page already speaks the same language. Swap in your brand and go live.
          </p>
        </div>

        {/* Flagship feature */}
        <div className="mt-10 grid items-stretch gap-8 overflow-hidden rounded-card border border-paper/10 bg-paper/[0.03] lg:grid-cols-2">
          <Link href={`/packs/${hero.slug}`} className="group relative block">
            <PreviewImage
              src={hero.coverImageKey}
              alt={hero.title}
              type="pack"
              color="blue"
              label="Premium pack"
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="h-full min-h-[280px] w-full object-cover transition group-hover:scale-[1.02]"
            />
          </Link>
          <div className="flex flex-col justify-center p-8 lg:p-10">
            <h3 className="text-h3 font-bold text-paper">{hero.title}</h3>
            {hero.description && (
              <p className="mt-3 line-clamp-4 text-body text-paper/75">{hero.description}</p>
            )}
            <ul className="mt-5 space-y-2">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2 text-small text-paper/85">
                  <Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-action" /> {b}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                href={`/packs/${hero.slug}`}
                className="inline-flex h-12 items-center justify-center rounded-button bg-action px-6 text-base font-semibold text-paper transition hover:brightness-110"
              >
                Get the pack — {heroPrice}
              </Link>
              <span className="text-small text-paper/60">One-time · instant download · commercial license</span>
            </div>
          </div>
        </div>

        {/* Additional packs */}
        {rest.length > 0 && (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((p) => (
              <Link
                key={p.id}
                href={`/packs/${p.slug}`}
                className="group flex flex-col overflow-hidden rounded-card border border-paper/10 bg-paper/[0.03] transition hover:-translate-y-0.5 hover:bg-paper/[0.06]"
              >
                <PreviewImage
                  src={p.coverImageKey}
                  alt={p.title}
                  type="pack"
                  color="blue"
                  label="Premium pack"
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="aspect-[3/2]"
                />
                <div className="flex items-center justify-between gap-2 p-5">
                  <h3 className="truncate text-body font-semibold text-paper">{p.title}</h3>
                  <span className="shrink-0 text-body font-bold text-action">{priceLabel(p)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8">
          <Link href="/pricing" className="text-small font-semibold text-paper/80 underline underline-offset-4 hover:text-paper">
            See all packs & the all-access membership →
          </Link>
        </div>
      </Container>
    </section>
  );
}
