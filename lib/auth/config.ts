import type { NextAuthConfig, Session } from 'next-auth';

export function isAdmin(session: Session | null): boolean {
  return session?.user?.role === 'admin';
}

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [], // Email/credentials providers added below in index.ts
  callbacks: {
    session({ session, token }) {
      if (session.user) session.user.role = (token.role as string) ?? 'user';
      return session;
    },
    jwt({ token, user }) {
      if (user) token.role = (user as any).role ?? 'user';
      return token;
    },
  },
};
