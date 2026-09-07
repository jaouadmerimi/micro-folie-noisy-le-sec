import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const base = 'http://localhost:3000';
let cookie = '';
async function call(path, data, { auth = true, origin = base } = {}) {
  const r = await fetch(base + '/api/' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: {
      ...(data === undefined
        ? {}
        : { 'Content-Type': 'application/json', Origin: origin }),
      ...(auth && cookie ? { Cookie: cookie } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(90000),
  });
  for (const c of r.headers.getSetCookie())
    if (c.includes('session_token=')) cookie = c.split(';')[0];
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { error: text.slice(0, 300) };
  }
  return { status: r.status, body };
}
assert.equal((await call('admin', undefined, { auth: false })).status, 401);
assert.equal(
  (
    await call('auth/sign-up/email', {
      name: 'Attacker',
      email: 'attacker@example.test',
      password: 'not-allowed-password',
    })
  ).status,
  404,
);
assert.equal(
  (await call('reservations', {}, { origin: 'https://evil.example.test' }))
    .status,
  403,
);
const cfg = JSON.parse(readFileSync('work/runtime-secrets.json', 'utf8'));
const passFile = 'work/local-test-password.txt';
const password = existsSync(passFile)
  ? readFileSync(passFile, 'utf8')
  : randomBytes(28).toString('base64url');
if (!existsSync(passFile)) writeFileSync(passFile, password);
const activate = await call('activate', {
  token: readFileSync('work/local-bootstrap.txt', 'utf8'),
  name: 'Test local',
  password,
});
assert.ok([200, 409].includes(activate.status), JSON.stringify(activate));
const login = await call('auth/sign-in/email', {
  email: cfg.ADMIN_EMAIL,
  password,
  rememberMe: false,
});
assert.equal(login.status, 200, JSON.stringify(login));
assert.ok(cookie, 'Session cookie missing');
assert.equal(
  (
    await call('activate', {
      token: readFileSync('work/local-bootstrap.txt', 'utf8'),
      name: 'Again',
      password,
    })
  ).status,
  409,
);
let dashboard = await call('admin');
assert.equal(dashboard.status, 200, JSON.stringify(dashboard));
const w = {
  title: 'TEST LOCAL · Atelier ' + Date.now(),
  description: 'Atelier fictif réservé aux tests locaux',
  category: 'FabLab',
  starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  ends_at: new Date(Date.now() + 7 * 86400000 + 3600000).toISOString(),
  capacity: 1,
  min_age: 6,
  status: 'published',
};
const created = await call('admin/workshops', w);
assert.equal(created.status, 200, JSON.stringify(created));
w.id = created.body.id;
const token = randomBytes(32).toString('hex');
const reservation = await call(
  'reservations',
  {
    workshopId: w.id,
    firstName: 'Test',
    lastName: 'Local',
    email: 'visitor-' + Date.now() + '@example.test',
    phone: '',
    participants: 1,
    consent: true,
    requestKey: crypto.randomUUID(),
    token,
  },
  { auth: false },
);
assert.equal(reservation.status, 201, JSON.stringify(reservation));
assert.equal(reservation.body.status, 'pending');
assert.equal(reservation.body.emailSent, false);
const lookup = await call('reservation', { token }, { auth: false });
assert.equal(lookup.status, 200);
assert.equal(lookup.body.status, 'pending');
assert.equal(lookup.body.email, undefined);
assert.equal(
  (await call('admin/reservations', { ...lookup.body, status: 'confirmed' }))
    .status,
  200,
);
assert.equal(
  (await call('reservation', { token }, { auth: false })).body.status,
  'confirmed',
);
assert.equal(
  (await call('reservation', { token, action: 'cancel' }, { auth: false }))
    .status,
  200,
);
assert.equal(
  (await call('reservation', { token }, { auth: false })).body.status,
  'cancelled',
);
const draft = await call('admin/news', {
  title: 'TEST LOCAL · actualité',
  body: 'Texte de test',
  link: '',
  status: 'draft',
  published_at: new Date().toISOString(),
});
assert.equal(draft.status, 200, JSON.stringify(draft));
assert.ok(
  !(await call('public')).body.news.some((n) => n.id === draft.body.id),
);
assert.equal(
  (
    await call('admin/news', {
      id: draft.body.id,
      version: 1,
      title: 'TEST LOCAL · actualité',
      body: 'Texte publié',
      link: '',
      status: 'published',
      published_at: new Date().toISOString(),
    })
  ).status,
  200,
);
assert.ok((await call('public')).body.news.some((n) => n.id === draft.body.id));
assert.equal((await call('auth/sign-out', {})).status, 200);
assert.equal((await call('admin')).status, 401);
console.log(
  'PASS: email/password activation, signup blocked, authentication, CSRF, workshop creation, persisted booking, confirmation, cancellation, drafts/public news, logout. Test data exists only in local D1.',
);
