import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { CtaNote } from '@/components/ui/CtaNote';

// Benefit-led opener: answers "why download from here?" before we ask anyone to browse.
// Stats are passed in from the live catalog so the numbers stay honest.
const REASONS = [
  'Built specifically for Divi 5 — not retrofitted from older builders',
  'Lightweight, import-ready JSON — paste it straight into the builder',
  'Professionally designed sections with real copy and images',
  'New layouts added every month — the library keeps growing',
];

export function WhyChoose({ layoutCount, industryCount }: { layoutCount: number; industryCount: number }) {
  // Each stat carries its own accent (from the brand's gradient palette) so the rail reads
  // colorful, not grey. Class strings are literal so Tailwind's JIT keeps them.
  const stats = [
    { value: layoutCount > 0 ? `${layoutCount}` : '—', label: 'validated layouts', card: 'border-g-purple/25 bg-g-purple/10', num: 'text-g-purple' },
    { value: industryCount > 0 ? `${industryCount}` : '—', label: 'industries covered', card: 'border-g-cyan/25 bg-g-cyan/10', num: 'text-g-cyan' },
    { value: '100%', label: 'pass the validator', card: 'border-g-amber/30 bg-g-amber/10', num: 'text-g-amber' },
    { value: 'Free', label: 'to start', card: 'border-g-pink/25 bg-g-pink/10', num: 'text-g-pink' },
  ];

  return (
    <section className="border-b border-border bg-mist py-12">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-[1.7fr,1fr]">
          {/* Left — the pitch */}
          <div>
            <p className="text-small font-semibold uppercase tracking-wide text-action">Why creators choose Divi5Lab</p>
            <h2 className="mt-2 text-h2 text-navy">Everything you need to start faster — nothing you have to fix.</h2>
            <ul className="mt-6 space-y-3">
              {REASONS.map((r) => (
                <li key={r} className="flex items-start gap-3 text-body text-navy">
                  <Icon name="check_circle" size={22} className="mt-0.5 shrink-0 text-action" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col items-start gap-3">
              <Button href="/browse">Start browsing</Button>
              <CtaNote text="Free to start · No account needed" />
            </div>
          </div>

          {/* Right — honest, live stats as colorful stacked cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-1">
            {stats.map((s) => (
              <div key={s.label} className={`rounded-card border p-4 text-center shadow-soft ${s.card}`}>
                <p className={`text-h2 leading-none tabular-nums ${s.num}`}>{s.value}</p>
                <p className="mt-1.5 text-small font-medium text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
