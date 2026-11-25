import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

// Landing page for emailed sign-in links. Rendering it consumes nothing; the
// token is only spent when the visitor presses the button (a form POST).
export const metadata: Metadata = { title: 'Confirm sign in', robots: { index: false, follow: false } };

type Search = Promise<{ token?: string; email?: string; callbackUrl?: string }>;

export default async function ConfirmSignInPage({ searchParams }: { searchParams: Search }) {
  const { token, email, callbackUrl } = await searchParams;
  return (
    <main className="py-16">
      <Container className="max-w-md">
        <Card className="p-8 text-center">
          <h1 className="text-h3 text-navy">Confirm sign in</h1>
          {token && email ? (
            <>
              <p className="mt-3 text-body text-muted">
                Signing in as <strong className="text-navy">{email}</strong>. Press the button to finish.
              </p>
              <form method="POST" action="/api/magic-link/continue" className="mt-6">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="email" value={email} />
                {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
                <button
                  type="submit"
                  className="inline-flex h-11 w-full items-center justify-center rounded-button bg-action px-4 text-small font-semibold text-paper hover:brightness-110"
                >
                  Sign in
                </button>
              </form>
            </>
          ) : (
            <p className="mt-3 text-body text-muted">
              This sign-in link is incomplete. <Link href="/login" className="text-action underline">Request a new one</Link>.
            </p>
          )}
        </Card>
      </Container>
    </main>
  );
}
