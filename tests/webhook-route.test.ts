import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/stripe/webhook/route';

function post(body: string, sig?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (sig) headers['stripe-signature'] = sig;
  return new Request('http://test/api/stripe/webhook', { method: 'POST', headers, body });
}

describe('POST /api/stripe/webhook — signature gate (no DB)', () => {
  it('400 when the signature is missing/invalid', async () => {
    const res = await POST(post('{}', 'bad-signature'));
    expect(res.status).toBe(400);
  });
  it('400 when there is no signature header at all', async () => {
    const res = await POST(post('{}'));
    expect(res.status).toBe(400);
  });
});
