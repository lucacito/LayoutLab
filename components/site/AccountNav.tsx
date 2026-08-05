'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

// Auth-aware nav (client, so catalog pages stay static). Shows Sign in when
// logged out, Account when logged in, and Admin for admins.
export function AccountNav({ inverted = false }: { inverted?: boolean }) {
  const { data: session } = useSession();
  const user = session?.user as { role?: string } | undefined;

  const linkCls = `text-small font-medium transition ${
    inverted ? 'text-paper/85 hover:text-paper' : 'text-navy hover:text-action'
  }`;

  if (!user) {
    return <Link href="/login" className={linkCls}>Sign in</Link>;
  }
  return (
    <>
      {user.role === 'admin' && (
        <Link href="/admin" className={`${linkCls} ${inverted ? '' : 'text-action'}`}>Admin</Link>
      )}
      <Link href="/account" className={linkCls}>Account</Link>
    </>
  );
}
