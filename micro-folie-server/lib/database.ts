import { Pool, types } from 'pg';

let pool: Pool | undefined;
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('Database is not configured');
  return pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    types: { getTypeParser: (oid: number, format?: any) => oid === 20 ? Number : types.getTypeParser(oid, format) },
  });
}

// Retain the application's parameterized statement interface during the move
// from SQLite to Postgres. No SQL is accepted from HTTP requests.
function postgresSQL(sql: string, previousChanges = 0) {
  let quoted = false, position = 0, result = '';
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") {
      if (quoted && sql[i + 1] === "'") { result += "''"; i++; continue; }
      quoted = !quoted;
    }
    result += c === '?' && !quoted ? '$' + (++position) : c;
  }
  return result.replaceAll('changes()', String(previousChanges)).replace(/FROM user\b/g, 'FROM "user"');
}

export class Statement {
  constructor(readonly db: Database, readonly sql: string, readonly args: any[] = []) {}
  bind(...args: any[]) { return new Statement(this.db, this.sql, args); }
  async first<T = any>(): Promise<T | null> { return (await this.db.execute(this)).rows[0] ?? null; }
  async all() { return { results: (await this.db.execute(this)).rows }; }
  async run() { return { meta: { changes: (await this.db.execute(this)).rowCount ?? 0 } }; }
}

export class Database {
  constructor(readonly pool: Pool) {}
  prepare(sql: string) { return new Statement(this, sql); }
  async execute(statement: Statement) { return this.pool.query(postgresSQL(statement.sql), statement.args); }
  async batch(statements: Statement[]) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize capacity decisions across instances; the lock is released by
      // COMMIT/ROLLBACK and never spans email delivery or other network calls.
      await client.query('SELECT pg_advisory_xact_lock(747430)');
      const results = [];
      let changes = 0;
      for (const statement of statements) {
        const result = await client.query(postgresSQL(statement.sql, changes), statement.args);
        changes = result.rowCount ?? 0;
        results.push({ results: result.rows, meta: { changes } });
      }
      await client.query('COMMIT');
      return results;
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (error.code === '23505') throw new Error('UNIQUE constraint violation');
      throw error;
    } finally { client.release(); }
  }
}

export class FileStore {
  constructor(readonly pool: Pool) {}
  async head(key: string) {
    return (await this.pool.query('SELECT key FROM files WHERE key=$1', [key])).rows[0] ?? null;
  }
  async put(key: string, data: Uint8Array, options: { httpMetadata: { contentType: string } }) {
    await this.pool.query('INSERT INTO files (key,content_type,data) VALUES ($1,$2,$3)', [key, options.httpMetadata.contentType, Buffer.from(data)]);
  }
  async get(key: string) {
    const file = (await this.pool.query('SELECT content_type,data FROM files WHERE key=$1', [key])).rows[0];
    return file ? { body: new Uint8Array(file.data), httpMetadata: { contentType: file.content_type } } : null;
  }
}
