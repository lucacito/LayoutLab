import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { packs, emailCaptures, entitlements, users } from '@/db/schema';
import { syncContact } from '@/lib/email/loops';
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

  async findOrCreateUserByEmail(email) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing[0]) return existing[0].id;
    const id = randomUUID();
    await db.insert(users).values({ id, email, role: 'user' }).onConflictDoNothing();
    const after = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    return after[0]?.id ?? id;
  },

  async grantFreeEntitlement(userId, packId) {
    await db
      .insert(entitlements)
      .values({ id: randomUUID(), userId, scope: `pack:${packId}`, source: 'free' })
      .onConflictDoNothing();
  },
};
