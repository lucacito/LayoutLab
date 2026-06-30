import { Container } from '@/components/ui/Container';

// Honest stat strip. Swap in real download/customer numbers as they grow.
const STATS = [
  { value: '46+', label: 'validated sections' },
  { value: '12', label: 'industries covered' },
  { value: '100%', label: 'pass the validator' },
  { value: 'Free', label: 'to start' },
];

export function SocialProof() {
  return (
    <section className="border-y border-border bg-mist py-10">
      <Container>
        <p className="text-center text-small font-semibold uppercase tracking-wide text-muted">
          Built for Divi 5 builders &amp; agencies
        </p>
        <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-h2 text-navy">{s.value}</p>
              <p className="mt-1 text-small text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
