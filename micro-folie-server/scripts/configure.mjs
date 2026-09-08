import { randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const values = {
  SITE_URL: 'https://microfolie-noisylesec.github.io',
  API_URL: 'https://micro-folie-api.vercel.app',
  ADMIN_EMAIL: 'jaouad.merimi@gmail.com',
  AUTH_SECRET: randomBytes(32).toString('base64url'),
  ENCRYPTION_KEY: randomBytes(32).toString('base64'),
};
const cli = process.env.VERCEL_CLI_PATH;
if (!cli) throw new Error('Pass VERCEL_CLI_PATH');
for (const [key, value] of Object.entries(values)) {
  const result = spawnSync(process.execPath, [cli, 'env', 'add', key, 'production', '--yes', '--scope', 'jaouad-merimi'], { input: value, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Could not save environment key: ' + key);
  appendFileSync('.env.production.local', '\n' + key + '=' + JSON.stringify(value) + '\n');
  console.log('Configured ' + key);
}
