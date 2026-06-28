import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema';

/** Find or create a user by email (normalized to lowercase). Returns the user id. */
export async function findOrCreateUserByEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, normalized)).limit(1);
  if (existing[0]) return existing[0].id;
  const id = randomUUID();
  await db.insert(users).values({ id, email: normalized, role: 'user' }).onConflictDoNothing();
  const row = await db.select({ id: users.id }).from(users).where(eq(users.email, normalized)).limit(1);
  return row[0]?.id ?? id;
}
