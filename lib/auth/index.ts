import NextAuth from 'next-auth';
import type { EmailConfig } from 'next-auth/providers';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/db/client';
import { users, accounts, sessions, verificationTokens } from '@/db/schema';
import { authConfig } from './config';
import { sendMagicLink } from '@/lib/email';

// Hand-built magic-link provider. We do NOT use next-auth/providers/email or
// /nodemailer — those throw "Nodemailer requires a `server` configuration" at
// construction. type:'email' drives Auth.js's verification-token flow; our
// sendVerificationRequest delivers the link via Resend (or console in dev).
const magicLink: EmailConfig = {
  id: 'email',
  type: 'email',
  name: 'Email',
  from: process.env.RESEND_FROM || 'Divi5Lab <onboarding@resend.dev>',
  maxAge: 24 * 60 * 60,
  options: {},
  sendVerificationRequest: async ({ identifier, url }: { identifier: string; url: string }) => {
    // Dev convenience: with no RESEND_API_KEY, no email is sent — print the
    // sign-in link so local login works without email configured.
    if (!process.env.RESEND_API_KEY) {
      console.log(`\n[auth:dev] magic sign-in link for ${identifier}:\n${url}\n`);
    }
    await sendMagicLink(identifier, url);
  },
} as EmailConfig;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [magicLink],
});
