import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;

// Next.js would otherwise serve HEAD by running GET, and a HEAD probe from a
// mail scanner against a legacy /api/auth/callback/email link would consume the
// single-use sign-in token. Nothing in Auth.js needs HEAD, so answer it inertly.
export async function HEAD() {
  return new Response(null, { status: 200 });
}
