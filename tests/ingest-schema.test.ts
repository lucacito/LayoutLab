import { describe, it, expect } from 'vitest';
import { parseIngestPayload, parseBearer } from '@/lib/ingest/schema';

const valid = {
  slug: 'hero-saas-minimal-1',
  title: 'Minimal SaaS Hero',
  type: 'hero',
  niche: 'saas',
  style: 'minimal',
  colors: ['blue'],
  diviJsonBlobKey: 'layouts/hero-saas-minimal-1.json',
  previewImageKeys: ['https://picsum.photos/seed/x/1200/900'],
  contentHash: 'hash-abc',
  validatorPassed: true,
};

describe('parseIngestPayload', () => {
  it('accepts a valid payload', () => {
    const r = parseIngestPayload(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.slug).toBe('hero-saas-minimal-1');
  });
  it('accepts validatorPassed:false at the schema level (route enforces true)', () => {
    expect(parseIngestPayload({ ...valid, validatorPassed: false }).ok).toBe(true);
  });
  it('rejects when a required field is missing', () => {
    const { title, ...missing } = valid;
    const r = parseIngestPayload(missing);
    expect(r.ok).toBe(false);
  });
  it('rejects when validatorPassed is absent', () => {
    const { validatorPassed, ...missing } = valid;
    expect(parseIngestPayload(missing).ok).toBe(false);
  });
  it('preserves the full card variant including iconStyle', () => {
    const r = parseIngestPayload({ ...valid, type: 'cards', variant: { group: 'cards-saas-minimal', columns: 3, icons: 'left', iconStyle: 'number' } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.variant).toEqual({ group: 'cards-saas-minimal', columns: 3, icons: 'left', iconStyle: 'number' });
  });
});

describe('parseBearer', () => {
  it('extracts the token from a Bearer header', () => {
    expect(parseBearer('Bearer abc123')).toBe('abc123');
  });
  it('returns null for missing or malformed headers', () => {
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer('Basic abc')).toBeNull();
    expect(parseBearer('abc')).toBeNull();
  });
});
