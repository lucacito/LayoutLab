import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { WaitlistForm } from '@/components/plugins/WaitlistForm';

export const metadata: Metadata = {
  title: 'Divi 5 AI Editor — coming soon',
  description:
    'Edit and generate Divi 5 pages with AI. Every change is checked by a deterministic validator, so output always imports cleanly. Join the waitlist.',
};

const FEATURES = [
  'Describe a page or section in plain English and get real Divi 5 modules back',
  'Edit existing Divi 5 pages with AI without breaking the layout',
  'Every change is checked by a deterministic validator before it ever touches your site',
];

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-body text-navy">
      <Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-action" /> {children}
    </li>
  );
}

export default function AiEditorPage() {
  return (
    <main className="py-16">
      <Container>
        <h1 className="text-h1 text-navy">The Divi 5 AI Editor</h1>
        <p className="mt-4 max-w-2xl text-lead text-muted">
          Edit and generate Divi 5 pages with AI. Every change is checked by a deterministic validator, so the
          output always imports cleanly — no broken layouts, ever.
        </p>

        <ul className="mt-8 max-w-2xl space-y-3">
          {FEATURES.map((f) => (
            <Feature key={f}>{f}</Feature>
          ))}
        </ul>

        <Card className="mt-10 max-w-2xl p-8">
          <span className="inline-flex w-fit items-center rounded-full border border-border bg-fog px-3 py-1 text-small font-semibold text-muted">
            Coming soon
          </span>
          <p className="mt-4 text-body text-navy">Be the first to know when the Divi 5 AI Editor launches.</p>
          <div className="mt-4">
            <WaitlistForm source="ai_editor_waitlist" cta="Join the waitlist" />
          </div>
        </Card>

        <section className="mt-16 rounded-card border border-border bg-fog p-8">
          <h2 className="text-section text-navy">Looking for a converter instead?</h2>
          <p className="mt-2 text-body text-muted">Move existing pages between page builders today.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/plugins/elementor-to-divi-5"
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-paper px-6 text-small font-semibold text-navy transition hover:border-action hover:text-action"
            >
              Elementor → Divi 5
            </Link>
            <Link
              href="/plugins/divi-to-elementor"
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-paper px-6 text-small font-semibold text-navy transition hover:border-action hover:text-action"
            >
              Divi → Elementor
            </Link>
          </div>
        </section>
      </Container>
    </main>
  );
}
