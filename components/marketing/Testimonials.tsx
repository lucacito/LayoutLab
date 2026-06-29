import { Container } from '@/components/ui/Container';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Icon } from '@/components/ui/Icon';

// PLACEHOLDER testimonials — replace with real ones before launch. Avatars use the
// Pravatar service as stand-ins.
const ITEMS = [
  {
    quote: 'I rebuilt a client’s landing page in an afternoon. The sections imported clean and just needed our copy dropped in.',
    name: 'Alex R.',
    role: 'Freelance Divi developer',
    avatar: 'https://i.pravatar.cc/96?img=12',
  },
  {
    quote: 'We use these as the starting point for every new site. The validator means no broken modules — that alone saves us hours.',
    name: 'Priya S.',
    role: 'Agency owner',
    avatar: 'https://i.pravatar.cc/96?img=45',
  },
  {
    quote: 'Being able to flip a 3-column grid to 4 columns or move the icons without rebuilding is exactly what I needed.',
    name: 'Marco D.',
    role: 'Web designer',
    avatar: 'https://i.pravatar.cc/96?img=33',
  },
];

export function Testimonials() {
  return (
    <section className="py-20">
      <Container>
        <SectionTitle eyebrow="Loved by builders" title="What people are saying">
          Real Divi pros, real time saved.
        </SectionTitle>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {ITEMS.map((t) => (
            <figure key={t.name} className="flex flex-col rounded-card border border-border bg-paper p-7 shadow-soft">
              <div className="flex gap-0.5 text-g-amber">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Icon key={i} name="star" size={18} />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-body text-navy">“{t.quote}”</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.avatar} alt="" width={44} height={44} className="h-11 w-11 rounded-full" />
                <span>
                  <span className="block text-body font-semibold text-navy">{t.name}</span>
                  <span className="block text-small text-muted">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}
