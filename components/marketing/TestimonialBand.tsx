import { Container } from '@/components/ui/Container';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { SectionShell } from '@/components/ui/SectionShell';
import type { Testimonial } from '@/lib/site/testimonials';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function Quote({ t, large = false }: { t: Testimonial; large?: boolean }) {
  return (
    <figure className="flex h-full flex-col rounded-panel border border-border bg-paper p-8 shadow-soft md:p-10">
      <span aria-hidden className="font-display text-6xl font-extrabold leading-none text-action/25">&ldquo;</span>
      <blockquote className={`-mt-2 flex-1 text-navy ${large ? 'text-h3' : 'text-lead'}`}>
        <p>{t.quote}</p>
      </blockquote>
      <figcaption className="mt-8 flex items-center gap-4">
        <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-pill bg-gradient-to-br from-action to-g-pink font-display text-body font-bold text-paper">
          {initials(t.name)}
        </span>
        <span>
          <span className="block text-body font-semibold text-navy">{t.name}</span>
          <span className="block text-small text-muted">{t.role}, {t.business}</span>
        </span>
      </figcaption>
    </figure>
  );
}

/** Customer words, verbatim (see lib/site/testimonials.ts for the rules). */
export function TestimonialBand({ items, eyebrow = 'From a designer who uses it', title = 'Built for the people who build Divi sites.' }: { items: Testimonial[]; eyebrow?: string; title?: string }) {
  const [lead, ...rest] = items;
  return (
    <SectionShell tone="mist" pad="lg">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-4 text-h2 text-navy">{title}</h2>
        </div>
        <div className={`mt-14 grid gap-6 ${rest.length ? 'lg:grid-cols-2' : 'mx-auto max-w-3xl'}`}>
          <Quote t={lead} large />
          {rest.map((t) => (
            <Quote key={t.quote} t={t} />
          ))}
        </div>
      </Container>
    </SectionShell>
  );
}
