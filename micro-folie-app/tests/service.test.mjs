import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { Service, token, uuid } from '../lib/service.ts';
import { parisInput, parisToUTC } from '../lib/dates.ts';
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const file of readdirSync('drizzle').filter((f) => f.endsWith('.sql')))
    sqlite.exec(readFileSync('drizzle/' + file, 'utf8'));
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          const statement = {
            sql,
            args,
            async first() {
              return sqlite.prepare(sql).get(...args) ?? null;
            },
            async all() {
              return { results: sqlite.prepare(sql).all(...args) };
            },
            async run() {
              return { meta: sqlite.prepare(sql).run(...args) };
            },
          };
          return statement;
        },
      };
    },
    async batch(stmts) {
      sqlite.exec('BEGIN');
      try {
        const r = stmts.map((s) => ({
          meta: sqlite.prepare(s.sql).run(...s.args),
        }));
        sqlite.exec('COMMIT');
        return r;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return {
    sqlite,
    s: new Service({
      DB: db,
      FILES: { head: async () => null },
      ADMIN_EMAIL: 'owner@example.test',
      SITE_URL: 'https://micro.example.test',
      ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    }),
  };
}
async function workshop(s, capacity = 2) {
  const w = {
    title: 'Atelier test',
    description: 'Description',
    category: 'FabLab',
    starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    ends_at: new Date(Date.now() + 7 * 86400000 + 3600000).toISOString(),
    capacity,
    min_age: 8,
    status: 'published',
  };
  return { ...w, ...(await s.saveWorkshop(w, 'owner@example.test')) };
}
function booking(w, email = 'visitor@example.test', participants = 1) {
  return {
    workshopId: w.id,
    firstName: 'Visiteur',
    lastName: 'Test',
    email,
    phone: '',
    participants,
    token: token(),
    requestKey: uuid(),
    consent: true,
  };
}
test('simultaneous requests cannot exceed capacity and overflow goes to waitlist', async () => {
  const { s, sqlite } = fixture(),
    w = await workshop(s, 3);
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      s.createReservation(booking(w, `guest${i}@example.test`)),
    ),
  );
  assert.equal(results.filter((x) => x.status === 'pending').length, 3);
  assert.equal(results.filter((x) => x.status === 'waitlist').length, 9);
  assert.equal((await s.publicData()).workshops[0].remaining, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM outbox').get().n, 12);
});
test('duplicate requests and idempotent retry do not create extra bookings', async () => {
  const { s, sqlite } = fixture(),
    w = await workshop(s),
    b = booking(w),
    a = await s.createReservation(b);
  const again = await s.createReservation(b);
  assert.equal(a.reference, again.reference);
  assert.equal(
    sqlite.prepare('SELECT COUNT(*) AS n FROM reservations').get().n,
    1,
  );
  await assert.rejects(() => s.createReservation(booking(w)), /demande existe/);
  await assert.rejects(
    () => s.createReservation({ ...b, token: token() }),
    /déjà utilisé/,
  );
});
test('cancellation releases seats and waitlist can be confirmed', async () => {
  const { s } = fixture(),
    w = await workshop(s, 1),
    a = booking(w),
    b = booking(w, 'other@example.test');
  await s.createReservation(a);
  await s.createReservation(b);
  const row = await s.lookupReservation(b.token);
  await assert.rejects(
    () => s.decide({ ...row, status: 'confirmed' }, 'owner@example.test'),
    /insuffisantes/,
  );
  await s.cancelReservation(a.token);
  await s.decide({ ...row, status: 'confirmed' }, 'owner@example.test');
  assert.equal((await s.lookupReservation(b.token)).status, 'confirmed');
  assert.equal((await s.publicData()).workshops[0].remaining, 0);
});
test('expired holds free capacity and cannot be confirmed', async () => {
  const { s, sqlite } = fixture(),
    w = await workshop(s, 1),
    b = booking(w);
  await s.createReservation(b);
  sqlite
    .prepare('UPDATE reservations SET hold_until=?')
    .run('2020-01-01T00:00:00.000Z');
  assert.equal((await s.lookupReservation(b.token)).status, 'expired');
  assert.equal((await s.publicData()).workshops[0].remaining, 1);
  await assert.rejects(
    async () =>
      s.decide(
        { ...(await s.lookupReservation(b.token)), status: 'confirmed' },
        'owner@example.test',
      ),
    /expiré/,
  );
});
test('stale decisions do not duplicate notification or overwrite cancellation', async () => {
  const { s, sqlite } = fixture(),
    w = await workshop(s),
    b = booking(w);
  await s.createReservation(b);
  const old = await s.lookupReservation(b.token);
  await s.decide({ ...old, status: 'confirmed' }, 'owner@example.test');
  const count = sqlite.prepare('SELECT COUNT(*) AS n FROM outbox').get().n;
  await assert.rejects(() =>
    s.decide({ ...old, status: 'confirmed' }, 'owner@example.test'),
  );
  assert.equal(
    sqlite.prepare('SELECT COUNT(*) AS n FROM outbox').get().n,
    count,
  );
  await s.cancelReservation(b.token);
  await s.cancelReservation(b.token);
  assert.equal((await s.lookupReservation(b.token)).status, 'cancelled');
});
test('invalid input, private drafts, future news and access controls', async () => {
  const { s } = fixture();
  await assert.rejects(() => s.authorize(null));
  await assert.rejects(() =>
    s.authorize({ id: 'x', email: 'stranger@example.test' }),
  );
  await s.authorize({ id: 'o', email: 'owner@example.test' });
  const w = await workshop(s);
  await assert.rejects(() =>
    s.createReservation({ ...booking(w), participants: -1 }),
  );
  await assert.rejects(() =>
    s.createReservation({ ...booking(w), consent: false }),
  );
  await assert.rejects(() =>
    s.saveNews(
      {
        title: 'X',
        body: 'Y',
        link: 'javascript:alert(1)',
        status: 'published',
        published_at: new Date().toISOString(),
      },
      'owner',
    ),
  );
  for (const status of ['draft', 'published'])
    await s.saveNews(
      {
        title: status,
        body: 'Texte',
        status,
        published_at: new Date(Date.now() + 86400000).toISOString(),
      },
      'owner',
    );
  assert.equal((await s.publicData()).news.length, 0);
});
test('seat capacity cannot shrink below active reservations; current workshop version enforced', async () => {
  const { s } = fixture(),
    w = await workshop(s, 3);
  await s.createReservation(booking(w, 'v@example.test', 2));
  await assert.rejects(
    () => s.saveWorkshop({ ...w, version: 1, capacity: 1 }, 'owner'),
    /capacité/,
  );
  await assert.rejects(
    () => s.saveWorkshop({ ...w, version: 1, status: 'archived' }, 'owner'),
    /demandes actives/,
  );
  await s.saveWorkshop({ ...w, version: 1, capacity: 4 }, 'owner');
  await assert.rejects(
    () => s.saveWorkshop({ ...w, version: 1 }, 'owner'),
    /changé/,
  );
});
test('email failures remain queued, secrets encrypted and successful retry clears body', async () => {
  const { s, sqlite } = fixture(),
    w = await workshop(s);
  await s.saveMailConfig({ from: 'team@example.test', key: 're_fakekey' });
  assert.ok(
    !sqlite
      .prepare("SELECT value FROM settings WHERE key='mail_key'")
      .get()
      .value.includes('re_fakekey'),
  );
  s.transport = async () => new Response('{}', { status: 503 });
  const r = await s.createReservation(booking(w));
  assert.equal(r.emailSent, false);
  assert.equal(
    sqlite.prepare('SELECT status FROM outbox').get().status,
    'pending',
  );
  s.transport = async () => Response.json({ id: 'test' });
  assert.equal((await s.flushMail()).sent, 1);
  const mail = sqlite.prepare('SELECT status,body FROM outbox').get();
  assert.equal(mail.status, 'sent');
  assert.equal(mail.body, '');
});
test('Paris timezone conversion handles winter, summer and rejects missing DST hour', () => {
  assert.equal(parisToUTC('2026-09-12T14:00'), '2026-09-12T12:00:00.000Z');
  assert.equal(parisToUTC('2026-12-12T14:00'), '2026-12-12T13:00:00.000Z');
  assert.equal(parisInput('2026-09-12T12:00:00.000Z'), '2026-09-12T14:00');
  assert.throws(() => parisToUTC('2026-03-29T02:30'));
});
test('public HTML retains all original sections and working live form', () => {
  const html = readFileSync('site.html', 'utf8');
  for (const id of [
    'reserver',
    'reserveForm',
    'actualites',
    'actusGrid',
    'agenda',
    'agendaGrid',
    'espaces',
    'infos',
    'groupes',
    'reseau',
  ])
    assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(!html.includes('Réservation envoyée ✓'));
  assert.ok(!html.includes('ACTUS_CSV_URL'));
  assert.ok(!html.includes('Se connecter avec ChatGPT'));
});
