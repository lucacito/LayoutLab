import type { Metadata } from 'next';
import { readLicense } from '@/lib/license';
import { REFUND_POLICY } from '@/lib/legal/refund';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';

export const metadata: Metadata = {
  title: 'License, Refunds & Privacy',
  description: 'The commercial license that comes with every Divi5Lab purchase, our digital-goods refund policy, and what this site and our plugins collect.',
};

const SUMMARY = [
  { ok: true, title: 'Unlimited sites', body: 'Use what you buy on any site you own.' },
  { ok: true, title: 'Client work', body: 'Build for clients, with no extra seats and no per-site fees.' },
  { ok: true, title: 'Keeps working', body: 'A lapsed license never breaks an activated site.' },
  { ok: false, title: 'No resale', body: 'Don’t sell or license the files themselves.' },
  { ok: false, title: 'No redistribution', body: 'Don’t republish downloads as your own library.' },
];

export default function LicensePage() {
  const license = readLicense();
  return (
    <main className="py-16">
      <Container className="max-w-3xl">
        <h1 className="text-h1 text-navy">License</h1>
        <p className="mt-3 text-body text-muted">
          One simple commercial license covers every purchase. The plain-English version first; the binding text
          below is also bundled inside every download.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SUMMARY.map((s) => (
            <Card key={s.title} className="flex items-start gap-3 p-5">
              <Icon
                name={s.ok ? 'check_circle' : 'block'}
                size={20}
                className={`mt-0.5 shrink-0 ${s.ok ? 'text-green-600' : 'text-red-500'}`}
              />
              <div>
                <h2 className="text-body font-semibold text-navy">{s.title}</h2>
                <p className="mt-0.5 text-small text-muted">{s.body}</p>
              </div>
            </Card>
          ))}
        </div>

        <h2 className="mt-12 text-section text-navy">The full text</h2>
        <Card className="mt-4 p-6">
          <pre className="whitespace-pre-wrap font-sans text-small leading-relaxed text-navy">{license}</pre>
        </Card>

        <h2 className="mt-12 text-section text-navy">Refunds</h2>
        <p className="mt-3 text-body text-muted">{REFUND_POLICY}</p>

        <h2 id="privacy" className="mt-12 text-section text-navy">Privacy</h2>
        <div className="mt-3 space-y-3 text-body text-muted">
          <p>
            <strong className="text-navy">Free converter plugins</strong> send nothing unless you turn on coverage
            sharing from the plugin&apos;s coverage panel. When you do, the plugin posts the product name and the names
            of the module or widget types it could not convert, at most once a week. No site address, page content,
            licence or personal data is included, and you can stop sharing from the same panel at any time.
          </p>
          <p>
            <strong className="text-navy">Pro plugins</strong> send the licence key, the site address and the plugin
            and WordPress version numbers when you activate or deactivate a licence and when WordPress checks for
            updates. That is what a licence needs to work.
          </p>
          <p>
            <strong className="text-navy">Accounts and purchases</strong> store your email address and what you
            bought. Payments are processed by Stripe; card details never reach this site.
          </p>
          <p>
            <strong className="text-navy">This website</strong> uses Google Analytics to count visits. Questions or
            deletion requests: support@divi5lab.com.
          </p>
        </div>
      </Container>
    </main>
  );
}
