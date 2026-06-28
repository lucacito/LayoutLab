import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleVercel, type VercelPgDatabase } from 'drizzle-orm/vercel-postgres';
import { sql } from '@vercel/postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Production (Vercel) uses @vercel/postgres (Neon serverless). Local development
// runs a plain Postgres (see docker-compose.yml), which the Neon driver cannot
// reach — so when POSTGRES_URL/DATABASE_URL points at localhost we use the
// node-postgres driver instead. Consumers see the same Drizzle query API.
const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? '';
const isLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(connectionString);

export const db = (
  isLocal
    ? drizzleNode(new Pool({ connectionString }), { schema })
    : drizzleVercel(sql, { schema })
) as unknown as VercelPgDatabase<typeof schema>;
