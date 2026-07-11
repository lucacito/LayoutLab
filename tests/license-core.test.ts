import { describe, it, expect } from 'vitest';
import {
  generateLicenseKey, normalizeSiteUrl, effectiveStatus, isLicenseUsable,
  isNewerVersion, PAST_DUE_GRACE_MS, PLUGIN_PRODUCTS,
} from '@/lib/license-server/core';

describe('generateLicenseKey', () => {
  it('produces JHMG-XXXX-XXXX-XXXX-XXXX from the safe alphabet', () => {
    const key = generateLicenseKey();
    expect(key).toMatch(/^JHMG(-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}){4}$/);
  });
  it('is deterministic given an injected rng', () => {
    const rng = (n: number) => Buffer.alloc(n, 0); // all zeros -> first alphabet char
    expect(generateLicenseKey(rng)).toBe('JHMG-AAAA-AAAA-AAAA-AAAA');
  });
});

describe('normalizeSiteUrl', () => {
  it('strips scheme, www and trailing slash, lowercases', () => {
    expect(normalizeSiteUrl('HTTPS://WWW.Example.com/')).toBe('example.com');
    expect(normalizeSiteUrl('http://example.com/blog/')).toBe('example.com/blog');
    expect(normalizeSiteUrl('example.com')).toBe('example.com');
  });
  it('rejects garbage', () => {
    expect(normalizeSiteUrl('')).toBeNull();
    expect(normalizeSiteUrl('not a url at all !!')).toBeNull();
  });
  it('accepts localhost for dev sites', () => {
    expect(normalizeSiteUrl('http://localhost:8080/')).toBe('localhost:8080');
  });
});

describe('effectiveStatus / isLicenseUsable', () => {
  const periodEnd = new Date('2026-07-01T00:00:00Z');
  it('past_due within 7-day grace is usable', () => {
    const now = new Date(periodEnd.getTime() + PAST_DUE_GRACE_MS - 1000);
    const l = { status: 'past_due' as const, currentPeriodEnd: periodEnd };
    expect(effectiveStatus(l, now)).toBe('past_due');
    expect(isLicenseUsable(l, now)).toBe(true);
  });
  it('past_due beyond grace reads as expired and unusable', () => {
    const now = new Date(periodEnd.getTime() + PAST_DUE_GRACE_MS + 1000);
    const l = { status: 'past_due' as const, currentPeriodEnd: periodEnd };
    expect(effectiveStatus(l, now)).toBe('expired');
    expect(isLicenseUsable(l, now)).toBe(false);
  });
  it('active is usable; canceled/expired are not', () => {
    const now = new Date('2026-07-11T00:00:00Z');
    expect(isLicenseUsable({ status: 'active', currentPeriodEnd: null }, now)).toBe(true);
    expect(isLicenseUsable({ status: 'canceled', currentPeriodEnd: null }, now)).toBe(false);
    expect(isLicenseUsable({ status: 'expired', currentPeriodEnd: null }, now)).toBe(false);
  });
});

describe('isNewerVersion', () => {
  it('compares dotted versions numerically', () => {
    expect(isNewerVersion('1.1.0', '1.0.9')).toBe(true);
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
    expect(isNewerVersion('1.0.0', '1.0.1')).toBe(false);
    expect(isNewerVersion('2.0', '1.9.9')).toBe(true);
    expect(isNewerVersion('1.10.0', '1.9.0')).toBe(true); // not lexicographic
  });
});

describe('PLUGIN_PRODUCTS', () => {
  it('lists exactly the two converter Pro slugs', () => {
    expect([...PLUGIN_PRODUCTS]).toEqual(['elementor-to-divi5-pro', 'divi-to-elementor-pro']);
  });
});
