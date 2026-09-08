import { readFileSync } from 'node:fs';
import { bindings } from '../lib/handler.ts';
import { makeAuth } from '../lib/auth.ts';
import { getPool } from '../lib/database.ts';
const password = readFileSync(0, 'utf8').trim();
if (password.length < 10) throw new Error('A password of at least 10 characters is required on stdin');
try {
  const env = bindings();
  const exists = await getPool().query('SELECT id FROM "user" WHERE email=$1', [env.ADMIN_EMAIL]);
  if (exists.rowCount) throw new Error('The owner account already exists; use the normal password change flow');
  await makeAuth(env).api.signUpEmail({ body: { email: env.ADMIN_EMAIL, name: 'Équipe Micro-Folie', password } });
  console.log('Owner account created with the requested password.');
} finally { await getPool().end(); }
