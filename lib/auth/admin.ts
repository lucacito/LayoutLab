import type { Session } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isAdmin } from './config';

export type AdminGate = 'ok' | 'unauthenticated' | 'forbidden';

export function adminGateDecision(session: Session | null): AdminGate {
  if (!session?.user) return 'unauthenticated';
  return isAdmin(session) ? 'ok' : 'forbidden';
}

export async function requireAdmin(): Promise<Session> {
  const session = await auth();
  const gate = adminGateDecision(session);
  if (gate === 'unauthenticated') redirect('/login');
  if (gate === 'forbidden') notFound();
  return session as Session;
}

export function userGateDecision(session: Session | null): 'ok' | 'unauthenticated' {
  return session?.user ? 'ok' : 'unauthenticated';
}

export async function requireUser(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return session as Session;
}
