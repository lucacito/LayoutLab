import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const CAPTURE_COOKIE = 'll_capture';

export function signCapture(email: string, secret: string): string {
  const payload = Buffer.from(email, 'utf8').toString('base64url');
  const mac = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${mac}`;
}

export function verifyCapture(value: string | null | undefined, secret: string): string | null {
  if (!value || !value.includes('.')) return null;
  const [payload, mac] = value.split('.');
  if (!payload || !mac) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return Buffer.from(payload, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

export async function setCaptureCookie(email: string): Promise<void> {
  const store = await cookies();
  store.set(CAPTURE_COOKIE, signCapture(email, process.env.AUTH_SECRET ?? ''), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function readCaptureEmail(): Promise<string | null> {
  const store = await cookies();
  return verifyCapture(store.get(CAPTURE_COOKIE)?.value, process.env.AUTH_SECRET ?? '');
}
