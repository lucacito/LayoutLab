import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/config';

// A providers-free NextAuth instance is edge-safe; it only reads the JWT.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (!req.auth) {
    return Response.redirect(new URL('/login', req.nextUrl.origin));
  }
});

export const config = { matcher: ['/admin/:path*'] };
