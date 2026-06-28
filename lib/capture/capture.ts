export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class CaptureError extends Error {
  code: 'not_free';
  constructor(code: 'not_free' = 'not_free') {
    super(code);
    this.name = 'CaptureError';
    this.code = code;
  }
}

export interface CaptureDeps {
  getFreePack(packId: string): Promise<{ id: string } | null>;
  recordCapture(email: string, packId: string): Promise<string>;
  setCaptureSynced(captureId: string, synced: boolean): Promise<void>;
  syncContact(input: { email: string; packId?: string; source?: string }): Promise<{ synced: boolean }>;
  findOrCreateUserByEmail(email: string): Promise<string>;
  grantFreeEntitlement(userId: string, packId: string): Promise<void>;
}

export async function captureFreePack(
  input: { email: string; packId: string },
  deps: CaptureDeps,
): Promise<{ ok: true; email: string }> {
  const email = normalizeEmail(input.email);
  const pack = await deps.getFreePack(input.packId);
  if (!pack) throw new CaptureError('not_free');

  const captureId = await deps.recordCapture(email, input.packId);
  const { synced } = await deps.syncContact({ email, packId: input.packId, source: 'free_pack' });
  await deps.setCaptureSynced(captureId, synced);

  const userId = await deps.findOrCreateUserByEmail(email);
  await deps.grantFreeEntitlement(userId, input.packId);

  return { ok: true, email };
}
