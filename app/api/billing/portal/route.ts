import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { requireUser } from '@/lib/auth/admin';
import { getStripeCustomerIdByEmail } from '@/lib/account/queries';
import { createBillingPortalSession } from '@/lib/stripe/portal';

export const runtime = 'nodejs';

export async function POST(_req: Request): Promise<Response> {
  const session = await requireUser();
  const email = session.user?.email;
  const customerId = email ? await getStripeCustomerIdByEmail(email) : null;
  if (!customerId) return NextResponse.json({ error: 'no_billing_account' }, { status: 400 });
  const url = await createBillingPortalSession(customerId, `${env.NEXT_PUBLIC_SITE_URL}/account/billing`);
  return NextResponse.json({ url });
}
