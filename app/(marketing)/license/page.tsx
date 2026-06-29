import type { Metadata } from 'next';
import { readLicense } from '@/lib/license';
import { REFUND_POLICY } from '@/lib/legal/refund';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

export const metadata: Metadata = {
  title: 'License & Refunds — LayoutLab',
  description: 'The commercial license that comes with every LayoutLab purchase, plus our digital-goods refund policy.',
};

export default function LicensePage() {
  const license = readLicense();
  return (
    <main className="py-16">
      <Container className="max-w-3xl">
        <h1 className="text-h1 text-navy">License</h1>
        <p className="mt-3 text-body text-muted">
          Every purchase includes the commercial license below. It is also bundled inside every download.
        </p>
        <Card className="mt-8 p-6">
          <pre className="whitespace-pre-wrap font-sans text-small leading-relaxed text-navy">{license}</pre>
        </Card>

        <h2 className="mt-12 text-section text-navy">Refunds</h2>
        <p className="mt-3 text-body text-muted">{REFUND_POLICY}</p>
      </Container>
    </main>
  );
}
