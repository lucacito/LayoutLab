import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    // Phase 0: minimal credentials provider so login flow exists end-to-end.
    // Phase 5 swaps/adds magic-link (Resend) + proper password hashing.
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        // TODO(Phase 4/5): look up user in db, verify hashed password.
        if (creds?.email) return { id: 'temp', email: String(creds.email), role: 'user' } as any;
        return null;
      },
    }),
  ],
});
