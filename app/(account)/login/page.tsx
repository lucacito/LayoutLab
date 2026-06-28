import { signIn } from '@/lib/auth';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

export default function LoginPage() {
  return (
    <main className="py-16">
      <Container className="max-w-md">
        <Card className="p-8">
          <h1 className="text-h3 text-navy">Sign in</h1>
          <p className="mt-2 text-small text-muted">
            Enter your email and we&apos;ll send you a magic sign-in link.
          </p>
          <form
            action={async (formData: FormData) => {
              'use server';
              await signIn('email', { email: formData.get('email'), redirectTo: '/account' });
            }}
            className="mt-6 space-y-3"
          >
            <input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="w-full rounded-card border border-fog bg-paper px-3 py-2 text-body text-navy outline-none focus:border-action"
            />
            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center rounded-button bg-action px-4 text-small font-semibold text-paper hover:brightness-110"
            >
              Email me a sign-in link
            </button>
          </form>
        </Card>
      </Container>
    </main>
  );
}
