import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __resetRateLimit } from '@/lib/rate-limit';

const insertValues = vi.fn().mockResolvedValue(undefined);
vi.mock('@/db/client', () => ({
  db: {
    insert: () => ({ values: insertValues }),
    select: () => ({ from: () => ({ where: () => Promise.resolve([{ count: 0 }]) }) }),
  },
}));

import { POST } from '@/app/api/plugin/coverage/route';

function post(body: unknown) {
  return new Request('http://test/api/plugin/coverage', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/plugin/coverage', () => {
  beforeEach(() => { insertValues.mockClear(); __resetRateLimit(); });

  it('accepts a valid report', async () => {
    const res = await POST(post({ product: 'elementor-to-divi5', widget_types: ['lottie'] }));
    expect(res.status).toBe(200);
    expect(insertValues).toHaveBeenCalledOnce();
  });

  it('400 on an unknown product', async () => {
    const res = await POST(post({ product: 'not-a-product', widget_types: ['lottie'] }));
    expect(res.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('400 on malformed json', async () => {
    expect((await POST(post('{nope'))).status).toBe(400);
  });

  it('400 when widget_types is oversized', async () => {
    const res = await POST(post({
      product: 'elementor-to-divi5',
      widget_types: Array.from({ length: 101 }, (_, i) => `w${i}`),
    }));
    expect(res.status).toBe(400);
  });

  it('400 when a widget type string is too long', async () => {
    const res = await POST(post({ product: 'elementor-to-divi5', widget_types: ['x'.repeat(65)] }));
    expect(res.status).toBe(400);
  });

  it('de-duplicates repeated types before storing', async () => {
    await POST(post({ product: 'elementor-to-divi5', widget_types: ['lottie', 'lottie', 'hotspot'] }));
    expect(insertValues.mock.calls[0][0].widgetTypes).toEqual(['lottie', 'hotspot']);
  });
});
