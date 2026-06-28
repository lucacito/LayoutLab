'use server';
import { redirect } from 'next/navigation';
import { signIn } from '@/lib/auth';
import { captureFreePack, CaptureError } from './capture';
import { captureDeps } from './store';

export async function captureFreePackAction(packId: string, formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '');
  if (!email.trim()) redirect('/packs?capture=error');
  try {
    await captureFreePack({ email, packId }, captureDeps);
  } catch (err) {
    if (err instanceof CaptureError) redirect(`/packs?capture=error`);
    throw err;
  }
  // Sends the magic link; after the user clicks it they land on their downloads
  // with the free entitlement already granted.
  await signIn('email', { email, redirectTo: '/account/downloads' });
}
