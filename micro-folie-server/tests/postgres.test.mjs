import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';

test('Postgres reservations, signed admin sessions, news and private images', async () => {
  const originalURL = process.env.DATABASE_URL;
  const setup = new Pool({ connectionString: originalURL });
  const schemaName = 'mf_test_' + randomUUID().replaceAll('-', '');
  assert.match(schemaName, /^mf_test_[a-f0-9]{32}$/);
  await setup.query('CREATE SCHEMA ' + schemaName);
  const scoped = new URL(process.env.DATABASE_URL_UNPOOLED || originalURL);
  scoped.searchParams.set('options', '-c search_path=' + schemaName);
  process.env.DATABASE_URL = scoped.toString();
  process.env.SITE_URL = 'https://jaouadmerimi.github.io/micro-folie-noisy-le-sec';
  process.env.API_URL = 'https://micro-folie-api.vercel.app';
  process.env.ADMIN_EMAIL = 'owner@example.test';
  process.env.AUTH_SECRET = randomBytes(32).toString('base64url');
  process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
  const { getPool } = await import('../lib/database.ts');
  const { bindings } = await import('../lib/handler.ts');
  const { makeAuth } = await import('../lib/auth.ts');
  const { Service, token, uuid } = await import('../lib/service.ts');
  const { default: entry } = await import('../api/index.ts');
  const pool = getPool();
  let bearer = '';
  async function call(path, data, { auth = true, origin = 'https://jaouadmerimi.github.io', method } = {}) {
    const response = await entry.fetch(new Request(process.env.API_URL + '/api/' + path, {
      method: method ?? (data === undefined ? 'GET' : 'POST'),
      headers: { Origin: origin, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(bearer && auth ? { Authorization: 'Bearer ' + bearer } : {}) },
      body: data === undefined ? undefined : JSON.stringify(data),
    }));
    if (response.headers.get('set-auth-token')) bearer = response.headers.get('set-auth-token');
    return { response, status: response.status, body: await response.json().catch(() => null) };
  }
  try {
    await pool.query(readFileSync('migrations/001_initial.sql', 'utf8'));
    const env = bindings(), service = new Service(env);
    assert.equal((await call('admin', undefined, { auth: false })).status, 401);
    assert.equal((await call('public', undefined, { origin: 'https://other.example.test' })).status, 403);
    assert.equal((await call('public', undefined, { method: 'OPTIONS' })).status, 204);
    assert.equal((await call('auth/sign-up/email', {})).status, 404);
    const password = randomBytes(5).toString('hex'); // The requested 10-character length is supported.
    await makeAuth(env).api.signUpEmail({ body: { email: process.env.ADMIN_EMAIL, name: 'Test', password } });
    assert.equal((await call('auth/sign-in/email', { email: process.env.ADMIN_EMAIL, password: 'incorrect-password' })).status, 401);
    const login = await call('auth/sign-in/email', { email: process.env.ADMIN_EMAIL, password });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    assert.ok(bearer.includes('.'));
    assert.equal(login.response.headers.get('set-cookie'), null);
    assert.equal(login.response.headers.get('access-control-allow-origin'), 'https://jaouadmerimi.github.io');
    assert.equal((await call('auth/get-session')).body.user.email, process.env.ADMIN_EMAIL);
    assert.equal((await call('admin')).status, 200);

    const w = { title: 'Atelier de test', description: 'Description', category: 'FabLab', capacity: 3, min_age: 8, status: 'published', starts_at: new Date(Date.now() + 7 * 86400000).toISOString(), ends_at: new Date(Date.now() + 7 * 86400000 + 3600000).toISOString() };
    const created = await call('admin/workshops', w);
    assert.equal(created.status, 200, JSON.stringify(created.body));
    w.id = created.body.id;
    const bookings = Array.from({ length: 12 }, (_, i) => ({ workshopId: w.id, firstName: 'Test', lastName: 'Test', email: `test${i}@example.test`, phone: '', participants: 1, token: token(), requestKey: uuid(), consent: true }));
    const results = await Promise.all(bookings.map(d => call('reservations', d, { auth: false })));
    for (const result of results) assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.equal(results.filter(r => r.body.status === 'pending').length, 3);
    assert.equal(results.filter(r => r.body.status === 'waitlist').length, 9);
    assert.equal((await call('public')).body.workshops[0].remaining, 0);
    const firstIndex = results.findIndex(r => r.body.status === 'pending');
    const duplicate = await call('reservations', bookings[firstIndex], { auth: false });
    assert.equal(duplicate.body.reference, results[firstIndex].body.reference);
    const adminData = (await call('admin')).body;
    const pending = adminData.reservations.find(r => r.reference === duplicate.body.reference);
    assert.equal((await call('admin/reservations', { id: pending.id, version: pending.version, status: 'confirmed' })).status, 200);
    assert.equal((await call('admin/reservations', { id: pending.id, version: pending.version, status: 'confirmed' })).status, 409);
    assert.equal((await call('reservation', { token: bookings[firstIndex].token, action: 'cancel' }, { auth: false })).status, 200);
    assert.equal((await call('public')).body.workshops[0].remaining, 1);
    const imageKey = uuid() + '.png';
    await env.FILES.put(imageKey, new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]), { httpMetadata: { contentType: 'image/png' } });
    const news = { title: 'Test', body: '<script>visible text</script>', status: 'draft', published_at: new Date().toISOString(), image_key: imageKey, link: '' };
    const saved = await call('admin/news', news);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal((await call('public')).body.news.length, 0);
    assert.equal((await call('image/' + imageKey, undefined, { auth: false })).status, 401);
    assert.equal((await call('image/' + imageKey)).status, 200);
    assert.equal((await call('admin/news', { ...news, id: saved.body.id, version: 1, status: 'published' })).status, 200);
    assert.equal((await call('public')).body.news.length, 1);
    assert.equal((await call('image/' + imageKey, undefined, { auth: false })).status, 200);
    assert.equal((await call('auth/sign-out', {})).status, 200);
    assert.equal((await call('admin')).status, 401);
    console.log('PASS: signed email/password sessions, CORS, 12 concurrent bookings, capacity, decisions, cancellation, news, image privacy, logout');
  } finally {
    await pool.end();
    await setup.query('DROP SCHEMA ' + schemaName + ' CASCADE');
    await setup.end();
    process.env.DATABASE_URL = originalURL;
  }
});
