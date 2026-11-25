import { callbackUrlFor } from '@/lib/auth/confirm-link';

// Target of the /auth/confirm button. Only a real form POST gets through to the
// token-consuming Auth.js callback.
export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const form = await req.formData();
  const token = form.get('token');
  const email = form.get('email');
  const callbackUrl = form.get('callbackUrl');
  if (typeof token !== 'string' || !token || typeof email !== 'string' || !email) {
    return Response.redirect(`${origin}/login`, 303);
  }
  return Response.redirect(
    callbackUrlFor(origin, { token, email, callbackUrl: typeof callbackUrl === 'string' ? callbackUrl : null }),
    303,
  );
}
