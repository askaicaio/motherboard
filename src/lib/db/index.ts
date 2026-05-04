import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

/**
 * Postgres client tuned for serverless on Vercel + Supabase Transaction Pooler.
 *
 * Key settings:
 * - `prepare: false` — required for Supabase pooler in transaction mode
 *   (it can't keep prepared statements across pooled connections).
 * - `max: 10` — allows up to 10 concurrent in-flight queries per Vercel
 *   function instance. The previous `max: 1` was a major bottleneck:
 *   the NextAuth session callback queries admin_users on every request,
 *   and pages that fetch their own data would serialize behind it.
 * - `idle_timeout: 20` — close idle connections after 20s so we don't
 *   accumulate stale connections during a function's lifetime.
 * - `connect_timeout: 10` — fail fast if Supabase pooler is unreachable.
 *
 * In a `next dev` environment, hot-reload would normally create multiple
 * `postgres()` clients. We cache on globalThis to avoid leaking sockets.
 */
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.pgClient ??
  postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });

export type DB = typeof db;
