import { signIn } from '@/lib/auth';

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm p-12">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <form
        action={async (formData) => {
          'use server';
          await signIn('credentials', {
            email: formData.get('email'),
            password: formData.get('password'),
            redirectTo: '/account',
          });
        }}
        className="mt-6 space-y-3"
      >
        <input name="email" type="email" placeholder="Email" className="w-full border p-2" required />
        <input name="password" type="password" placeholder="Password" className="w-full border p-2" />
        <button type="submit" className="w-full bg-black p-2 text-white">Sign in</button>
      </form>
    </main>
  );
}
