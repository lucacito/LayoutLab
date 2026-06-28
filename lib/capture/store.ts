import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { packs, emailCaptures, entitlements } from '@/db/schema';
import { syncContact } from '@/lib/email/loops';
import { findOrCreateUserByEmail } from '@/lib/users/find-or-create';
import type { CaptureDeps } from './capture';

export const captureDeps: CaptureDeps = {
  async getFreePack(packId) {
    const rows = await db
      .select({ id: packs.id })
      .from(packs)
      .where(and(eq(packs.id, packId), eq(packs.kind, 'free'), eq(packs.status, 'published')))
      .limit(1);
    return rows[0] ?? null;
  },

  async recordCapture(email, packId) {
    const id = randomUUID();
    await db.insert(emailCaptures).values({ id, email, packId });
    return id;
  },

  async setCaptureSynced(captureId, synced) {
    await db.update(emailCaptures).set({ loopsSynced: synced }).where(eq(emailCaptures.id, captureId));
  },

  syncContact,

  findOrCreateUserByEmail,

  async grantFreeEntitlement(userId, packId) {
    await db
      .insert(entitlements)
      .values({ id: randomUUID(), userId, scope: `pack:${packId}`, source: 'free' })
      .onConflictDoNothing();
  },
};
