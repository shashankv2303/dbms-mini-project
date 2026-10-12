import { Pool, PoolClient, QueryResultRow } from 'pg';

// One pool per server process (survives Next.js dev hot-reloads).
const globalForPg = globalThis as unknown as { __stPool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  }
  return new Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 10),
  });
}

export function pool(): Pool {
  if (!globalForPg.__stPool) globalForPg.__stPool = createPool();
  return globalForPg.__stPool;
}

export async function query<T extends QueryResultRow = any>(text: string, params: unknown[] = []) {
  return pool().query<T>(text, params);
}

export async function rows<T extends QueryResultRow = any>(text: string, params: unknown[] = []) {
  return (await query<T>(text, params)).rows;
}

export async function one<T extends QueryResultRow = any>(text: string, params: unknown[] = []) {
  return (await query<T>(text, params)).rows[0] as T | undefined;
}

/** Runs fn inside BEGIN ... COMMIT; any thrown error triggers ROLLBACK. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
