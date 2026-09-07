import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const password = readFileSync(0, 'utf8').trim();
const base = process.env.API_URL, origin = new URL(process.env.SITE_URL).origin;
let token = '';
async function call(path, data, auth = true) {
  const r = await fetch(base + '/api/' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { Origin: origin, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(auth && token ? { Authorization: 'Bearer ' + token } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const issued = r.headers.get('set-auth-token');
  if (issued && r.ok) token = issued;
  assert.equal(r.headers.get('access-control-allow-origin'), origin);
  return { status: r.status, body: await r.json() };
}
assert.equal((await call('admin', undefined, false)).status, 401);
assert.equal((await call('auth/sign-in/email', { email: process.env.ADMIN_EMAIL, password })).status, 200);
assert.ok(token);
assert.equal((await call('admin')).status, 200);
assert.equal((await call('auth/get-session')).body.user.email, process.env.ADMIN_EMAIL);
assert.equal((await call('auth/sign-out', {})).status, 200);
assert.equal((await call('admin')).status, 401);
console.log('Production login, protected admin, CORS and logout passed.');
