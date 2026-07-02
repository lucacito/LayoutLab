import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/site/contact', async (orig) => {
  const actual = await orig<typeof import('@/lib/site/contact')>();
  return { ...actual, sendContactMessage: vi.fn(async () => ({ sent: true })) };
});

import { POST } from '@/app/api/contact/route';
import { sendContactMessage } from '@/lib/site/contact';

function post(body: unknown) {
  return new Request('http://test/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const valid = { name: 'Ada', email: 'ada@x.com', message: 'Hello, I have a question about pricing.' };

describe('POST /api/contact', () => {
  it('400 on invalid payload (missing message)', async () => {
    const { name, email } = valid;
    const res = await POST(post({ name, email }));
    expect(res.status).toBe(400);
  });
  it('400 on a malformed email', async () => {
    const res = await POST(post({ ...valid, email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });
  it('200 and sends the message on a valid submission', async () => {
    const res = await POST(post(valid));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(sendContactMessage).toHaveBeenCalledWith(expect.objectContaining({ email: 'ada@x.com', message: valid.message }));
  });
});
