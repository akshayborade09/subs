import { Kysely, PostgresDialect, type Transaction } from 'kysely';
import pg from 'pg';
import { env } from '../config/env.js';
import type { Database } from './types.js';

const { Pool, types } = pg;

// node-postgres parses DATE into a JS Date at *local* midnight, which silently
// shifts every service date by a day depending on the server's timezone. A service
// date is a calendar fact, so keep it a string all the way to the client.
types.setTypeParser(types.builtins.DATE, (value: string) => value);

// date[] has its own OID and does NOT inherit the parser above, so
// `trials.service_dates` would otherwise come back as JS Dates and reintroduce the
// very off-by-one this is meant to prevent. Date literals never contain quotes or
// commas, so splitting the array literal is sufficient.
// pg's own types only enumerate scalar OIDs, so the array OID needs a cast.
const DATE_ARRAY_OID = 1182 as Parameters<typeof types.setTypeParser>[0];
types.setTypeParser(DATE_ARRAY_OID, (value: string) =>
  value === '{}' ? [] : value.slice(1, -1).split(','),
);

// bigserial arrives as a string; our id spaces are far below 2^53.
types.setTypeParser(types.builtins.INT8, (value: string) => Number(value));

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  // Sessions stay in UTC. Conversion to IST happens only in platform/time.ts,
  // never implicitly via a connection-level SET TIME ZONE.
  options: '-c timezone=UTC',
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});

export type DB = Kysely<Database>;
export type Tx = Transaction<Database>;
/** Accepts either the pool handle or an open transaction. */
export type Executor = DB | Tx;

export async function closeDb(): Promise<void> {
  await db.destroy();
}
