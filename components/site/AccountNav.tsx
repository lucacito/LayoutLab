'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

const linkCls = 'text-small font-medium text-navy transition hover:text-action';

// Auth-aware nav (client, so catalog pages stay static). Shows Sign in when
// logged out, Account when logged in, and Admin for admins.
export function AccountNav() {
  const { data: session } = useSession();
  const user = session?.user as { role?: string } | undefined;
  if (!user) {
    return <Link href="/login" className={linkCls}>Sign in</Link>;
  }
  return (
    <>
      {user.role === 'admin' && (
        <Link href="/admin" className={`${linkCls} text-action`}>Admin</Link>
      )}
      <Link href="/account" className={linkCls}>Account</Link>
    </>
  );
}
