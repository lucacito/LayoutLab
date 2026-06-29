'use server';
import { redirect } from 'next/navigation';
import { normalizeEmail } from './capture';
import { recordLeadCapture } from './lead';
import { setCaptureCookie } from './cookie';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function captureAndDownloadAction(layoutId: string, slug: string, formData: FormData): Promise<void> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  if (!EMAIL_RE.test(email)) redirect(`/layouts/${slug}?capture=error`);
  await recordLeadCapture(email);
  await setCaptureCookie(email);
  redirect(`/api/download/${layoutId}`);
}
