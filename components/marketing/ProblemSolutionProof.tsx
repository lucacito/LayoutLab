import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { CtaNote } from '@/components/ui/CtaNote';

const STEPS = [
  {
    key: 'problem',
    label: 'The problem',
    icon: 'sentiment_dissatisfied',
    title: 'Building Divi sections from scratch eats your day.',
    body: 'Nudging rows, columns, spacing and styles into place — for every hero, pricing table and CTA. Hours gone before the content is even in.',
  },
  {
    key: 'solution',
    label: 'The solution',
    icon: 'bolt',
    title: 'Import a ready-made section in seconds.',
    body: 'Browse the library, click a section, download the Divi 5 JSON and import. Real structure, real copy, real images — drop it in and tweak.',
  },
  {
    key: 'proof',
    label: 'The proof',
    icon: 'verified',
    title: 'Every section passes a deterministic validator.',
    body: 'No broken imports, no fixing someone else’s mess. Dozens of validated sections and counting — free to start, with curated packs when you scale.',
  },
];

export function ProblemSolutionProof() {
  return (
    <section className="py-14">
      <Container>
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.key} className="rounded-card border border-border bg-paper p-6 shadow-soft">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-action/10 text-action">
                <Icon name={s.icon} size={22} />
              </span>
              <p className="mt-4 text-small font-semibold uppercase tracking-wide text-action">{s.label}</p>
              <h3 className="mt-1.5 text-lead font-semibold text-navy">{s.title}</h3>
              <p className="mt-2 text-small text-muted">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Button href="/browse">Browse free sections</Button>
          <CtaNote text="Free to start · No account needed" />
        </div>
      </Container>
    </section>
  );
}
