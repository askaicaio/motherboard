import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// For serverless environments (Vercel), use connection pooling
const client = postgres(connectionString, {
  prepare: false, // Needed for Supabase transaction mode
  max: 1,         // Serverless: keep pool small
});

export const db = drizzle(client, { schema });

export type DB = typeof db;
