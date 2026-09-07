import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
const file = 'work/runtime-secrets.json';
mkdirSync('work', { recursive: true });
let values;
if (existsSync(file)) values = JSON.parse(readFileSync(file, 'utf8'));
else {
  const bootstrap = randomBytes(32).toString('hex');
  values = {
    ADMIN_EMAIL: process.env.MICRO_ADMIN_EMAIL ?? 'responsable@example.com',
    SITE_URL: 'https://micro-folie-noisy-le-sec.jaouad-merimi.chatgpt.site',
    AUTH_SECRET: randomBytes(48).toString('base64url'),
    ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    BOOTSTRAP_HASH: createHash('sha256').update(bootstrap).digest('hex'),
    BOOTSTRAP_EXPIRES: new Date(Date.now() + 7 * 86400000).toISOString(),
  };
  writeFileSync(file, JSON.stringify(values));
  writeFileSync(
    'work/owner-activation.html',
    `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Premier accès Micro-Folie</title><body style="font:18px system-ui;max-width:650px;margin:70px auto;padding:24px"><h1>Votre premier accès administrateur</h1><p>Ce lien personnel est utilisable une fois, pendant 7 jours. Ne le partagez pas.</p><p>Compte : ${values.ADMIN_EMAIL}</p><a href="${values.SITE_URL}/admin/activation#${bootstrap}">Créer mon mot de passe et activer mon compte</a></body></html>`,
  );
  writeFileSync('work/local-bootstrap.txt', bootstrap);
}
const local = { ...values, SITE_URL: 'http://localhost:3000' };
writeFileSync(
  '.env.local',
  Object.entries(local)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n'),
);
writeFileSync(
  '.dev.vars',
  Object.entries(local)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join('\n'),
);
console.log(
  'Les paramètres locaux ont été préparés dans les fichiers ignorés par Git.',
);
