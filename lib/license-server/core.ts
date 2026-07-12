// Pure license-domain logic. No DB, no HTTP — everything here is unit-testable
// and shared by the fulfillment webhook, the license API, and account queries.
import { randomBytes } from 'node:crypto';

export const PLUGIN_PRODUCTS = ['elementor-to-divi5-pro', 'divi-to-elementor-pro'] as const;
export type PluginProduct = (typeof PLUGIN_PRODUCTS)[number];

export const PRODUCT_TITLES: Record<PluginProduct, string> = {
  'elementor-to-divi5-pro': 'JHMG Converter For Elementor to Divi 5 — Pro',
  'divi-to-elementor-pro': 'JHMG Converter For Divi to Elementor — Pro',
};

// No 0/O/1/I/L so keys survive being read aloud or retyped from a receipt.
const KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateLicenseKey(rng: (n: number) => Buffer = randomBytes): string {
  const bytes = rng(16);
  const chars: string[] = [];
  for (let i = 0; i < 16; i++) chars.push(KEY_ALPHABET[bytes[i]! % KEY_ALPHABET.length]!);
  const g = (s: number) => chars.slice(s, s + 4).join('');
  return `JHMG-${g(0)}-${g(4)}-${g(8)}-${g(12)}`;
}

// Canonical site identity: host(+port)+path, lowercase, no scheme/www/trailing
// slash — so http://www.Foo.com/ and https://foo.com activate the same slot.
export function normalizeSiteUrl(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  if (!/^https?:\/\//.test(s)) s = `https://${s}`;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  const host = u.host.replace(/^www\./, '');
  const bareHost = u.hostname.replace(/^www\./, '');
  if (!bareHost.includes('.') && bareHost !== 'localhost') return null;
  const path = u.pathname.replace(/\/+$/, '');
  return host + path;
}

export const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export type StoredLicenseStatus = 'active' | 'past_due' | 'expired' | 'canceled' | 'revoked';

export interface LicenseRecord {
  id: string;
  userId: string;
  productSlug: string;
  licenseKey: string;
  status: StoredLicenseStatus;
  currentPeriodEnd: Date | null;
}

// past_due keeps Pro working for 7 days after the period lapses (covers Stripe
// payment retries); after that it reads as expired without waiting on a webhook.
// 'revoked' is terminal (refund/chargeback/manual): set only by ops, never by
// Stripe status mapping, and never clears on its own.
export function effectiveStatus(
  l: Pick<LicenseRecord, 'status' | 'currentPeriodEnd'>,
  now: Date,
): StoredLicenseStatus {
  if (l.status === 'past_due' && l.currentPeriodEnd
      && now.getTime() > l.currentPeriodEnd.getTime() + PAST_DUE_GRACE_MS) {
    return 'expired';
  }
  return l.status;
}

export function isLicenseUsable(
  l: Pick<LicenseRecord, 'status' | 'currentPeriodEnd'>,
  now: Date,
): boolean {
  const s = effectiveStatus(l, now);
  return s === 'active' || s === 'past_due';
}

export function isNewerVersion(candidate: string, installed: string): boolean {
  const parse = (v: string) => v.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const a = parse(candidate); const b = parse(installed);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0; const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}
