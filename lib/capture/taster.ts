import { cookies } from 'next/headers';
import { signCapture, verifyCapture } from './cookie';

// The "taster": one full page from a PAID theme pack, given away to exit/scroll
// lead-capturers as a quality sample. It stays paid-only site-wide (its layout page
// still shows the buy-the-pack CTA); the ONLY way to download it free is via this
// capture flow, which sets a signed cookie authorizing that one page's download.
export const TASTER_COOKIE = 'll_taster';

// Which page we give away. Env-overridable so it can be rotated without a deploy.
export const TASTER_SLUG =
  process.env.TASTER_LAYOUT_SLUG ?? 'blackline-studio-bold-agency-home-page-for-divi-5';

export async function setTasterCookie(slug: string): Promise<void> {
  const store = await cookies();
  store.set(TASTER_COOKIE, signCapture(slug, process.env.AUTH_SECRET ?? ''), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** The taster page slug this browser is authorized to download free, or null. */
export async function readTaster(): Promise<string | null> {
  const store = await cookies();
  return verifyCapture(store.get(TASTER_COOKIE)?.value, process.env.AUTH_SECRET ?? '');
}
