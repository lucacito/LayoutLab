import type { NextAuthConfig, Session } from 'next-auth';

export function isAdmin(session: Session | null): boolean {
  return session?.user?.role === 'admin';
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', verifyRequest: '/verify-request' },
  providers: [], // Email/credentials providers added below in index.ts
  callbacks: {
    session({ session, token }) {
      if (session.user) session.user.role = (token.role as string) ?? 'user';
      return session;
    },
    jwt({ token, user }) {
      if (user) token.role = isAdminEmail(user.email) ? 'admin' : 'user';
      return token;
    },
  },
};
