import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(747431)');
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  if (!(await client.query('SELECT version FROM schema_migrations WHERE version=$1', ['001_initial'])).rowCount) {
    await client.query(readFileSync('migrations/001_initial.sql', 'utf8'));
    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', ['001_initial']);
    console.log('Applied migration 001_initial');
  } else console.log('Migration 001_initial already applied');
  await client.query('COMMIT');
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }
