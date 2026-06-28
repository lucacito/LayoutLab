const LOOPS_URL = 'https://app.loops.so/api/v1/contacts/update';

export async function syncContact(input: { email: string; source?: string; packId?: string }): Promise<{ synced: boolean }> {
  const apiKey = process.env.LOOPS_API_KEY;
  if (!apiKey) {
    console.log(`[loops:dev] no LOOPS_API_KEY — would sync contact ${input.email}` + (input.packId ? ` (pack ${input.packId})` : ''));
    return { synced: false };
  }
  try {
    const res = await fetch(LOOPS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: input.email, source: input.source ?? 'website', ...(input.packId ? { freePackId: input.packId } : {}) }),
    });
    if (!res.ok) { console.error(`[loops] sync failed: ${res.status}`); return { synced: false }; }
    return { synced: true };
  } catch (err) {
    console.error('[loops] sync error:', err);
    return { synced: false };
  }
}
