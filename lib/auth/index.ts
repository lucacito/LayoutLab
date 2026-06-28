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
        // SECURITY (Phase 2): this is a password-less Phase-0 stub. Combined with
        // the ADMIN_EMAILS allowlist it would grant admin to anyone who knows an
        // admin email. Refuse in production until real password auth lands (Phase 4/5).
        if (process.env.NODE_ENV === 'production') return null;
        // TODO(Phase 4/5): look up user in db, verify hashed password.
        if (creds?.email) return { id: 'temp', email: String(creds.email), role: 'user' } as any;
        return null;
      },
    }),
  ],
});
