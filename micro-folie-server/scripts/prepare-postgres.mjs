import { readFileSync, writeFileSync } from 'node:fs';
let schema = readFileSync('../micro-folie-app/db/schema.ts', 'utf8')
  .replaceAll('sqliteTable', 'pgTable').replace('  integer,', '  integer,\n  boolean,\n  timestamp,')
  .replace('drizzle-orm/sqlite-core', 'drizzle-orm/pg-core')
  .replace(/integer\('email_verified', \{ mode: 'boolean' \}\)/g, "boolean('email_verified')")
  .replace(/integer\('([^']+)',\s*\{\s*mode: 'timestamp_ms',?\s*\}\)/g, "timestamp('$1', { withTimezone: true })");
writeFileSync('lib/schema.ts', schema);
const parts = readFileSync('../micro-folie-app/drizzle/0000_busy_strong_guy.sql', 'utf8')
  .replaceAll('`', '"').split('--> statement-breakpoint').map(x => x.trim()).filter(Boolean);
const tables = new Map(); const indexes = [];
for (let part of parts) {
  const match = part.match(/^CREATE TABLE "([^"]+)"/);
  if (!match) { indexes.push(part); continue; }
  if (['user', 'session', 'account', 'verification'].includes(match[1])) {
    part = part.replace(/"((?:access_token_|refresh_token_)?expires_at|created_at|updated_at)" integer/g, '"$1" timestamptz')
      .replace('"email_verified" integer', '"email_verified" boolean');
  }
  tables.set(match[1], part);
}
const order = ['user','workshops','account','session','verification','admins','audit','invitations','news','reservations','outbox','rate_limits','settings'];
writeFileSync('migrations/001_initial.sql', order.map(x => tables.get(x)).join('\n\n') + '\n\n' + indexes.join('\n') + '\n\nCREATE TABLE files (key text PRIMARY KEY, content_type text NOT NULL, data bytea NOT NULL CHECK (octet_length(data) <= 3145728));\n');
