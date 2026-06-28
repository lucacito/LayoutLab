import { randomBytes, createHash } from 'node:crypto';
import { db } from '@/db/client';
import { verificationTokens } from '@/db/schema';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface SignInUrlDeps {
  storeToken(identifier: string, hashedToken: string, expires: Date): Promise<void>;
  now(): Date;
}

// Reproduces Auth.js's email verification-token scheme so a receipt link clicks
// straight through Auth.js's real callback. Verified vs next-auth 5.0.0-beta.31:
//   @auth/core/lib/actions/signin/send-token.js  — token row = SHA-256(`${token}${secret}`), secret = AUTH_SECRET
//   @auth/core/lib/actions/callback/index.js      — re-hashes ?token, requires invite.identifier === ?email
// URL: ${SITE}/api/auth/callback/email?callbackUrl=&token=<raw>&email=<identifier>
export async function createMagicSignInUrl(email: string, callbackPath: string, deps: SignInUrlDeps): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is required to mint a sign-in link');
  const identifier = email.trim().toLowerCase();
  const token = randomBytes(32).toString('hex');
  const hashedToken = createHash('sha256').update(`${token}${secret}`).digest('hex');
  await deps.storeToken(identifier, hashedToken, new Date(deps.now().getTime() + TOKEN_TTL_MS));

  const site = process.env.NEXT_PUBLIC_SITE_URL!;
  const params = new URLSearchParams({ callbackUrl: `${site}${callbackPath}`, token, email: identifier });
  return `${site}/api/auth/callback/email?${params.toString()}`;
}

export const signInUrlDeps: SignInUrlDeps = {
  async storeToken(identifier, hashedToken, expires) {
    await db.insert(verificationTokens).values({ identifier, token: hashedToken, expires });
  },
  now: () => new Date(),
};
