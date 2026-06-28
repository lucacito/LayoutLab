import type { IngestPayload } from '@/lib/ingest/schema';

export async function postIngest(
  payload: IngestPayload,
  deps: { url: string; token: string; fetchFn?: typeof fetch },
): Promise<{ id: string; status: string; deduped: boolean }> {
  const doFetch = deps.fetchFn ?? fetch;
  const r = await doFetch(`${deps.url}/api/ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${deps.token}` },
    body: JSON.stringify(payload),
  });
  if (r.status === 401) throw new Error('ingest auth failed (401) — check INGEST_API_TOKEN');
  if (r.status === 422) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(`ingest rejected (422): ${body.error ?? 'invalid'}`);
  }
  if (!r.ok) throw new Error(`ingest failed (${r.status})`);
  return (await r.json()) as { id: string; status: string; deduped: boolean };
}
