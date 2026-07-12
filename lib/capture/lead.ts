import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { emailCaptures } from '@/db/schema';
import { normalizeEmail } from './capture';
import { syncContact } from '@/lib/email/loops';

// Records an email lead for a free individual download: an email_captures row
// (no pack) + a best-effort Loops sync. Never throws on a Loops failure.
export async function recordLeadCapture(email: string, source = 'free_download'): Promise<void> {
  const normalized = normalizeEmail(email);
  const id = randomUUID();
  await db.insert(emailCaptures).values({ id, email: normalized, packId: null });
  const { synced } = await syncContact({ email: normalized, source });
  await db.update(emailCaptures).set({ loopsSynced: synced }).where(eq(emailCaptures.id, id));
}
