import { Container } from '@/components/ui/Container';
import { Icon } from '@/components/ui/Icon';

// Real, honest trust signals (true product features).
const BADGES = [
  { icon: 'verified', label: 'Validated Divi 5', note: 'Passes a deterministic validator' },
  { icon: 'description', label: 'Commercial license', note: 'Unlimited client sites' },
  { icon: 'bolt', label: 'Instant download', note: 'Import-ready JSON' },
  { icon: 'person', label: 'No account needed', note: 'Free sections in one click' },
  { icon: 'lock', label: 'Secure checkout', note: 'Payments via Stripe' },
];

export function TrustBadges() {
  return (
    <section className="py-12">
      <Container>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {BADGES.map((b) => (
            <div key={b.label} className="flex items-center gap-3 rounded-card border border-border bg-paper p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-action/10 text-action">
                <Icon name={b.icon} size={20} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-small font-semibold text-navy">{b.label}</span>
                <span className="block truncate text-small text-muted">{b.note}</span>
              </span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
