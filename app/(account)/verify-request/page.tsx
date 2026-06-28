import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

export default function VerifyRequestPage() {
  return (
    <main className="py-16">
      <Container className="max-w-md">
        <Card className="p-8 text-center">
          <h1 className="text-h3 text-navy">Check your email</h1>
          <p className="mt-3 text-body text-muted">
            We sent a sign-in link to your inbox. Open it on this device to finish signing in.
            The link expires soon and can be used once.
          </p>
        </Card>
      </Container>
    </main>
  );
}
