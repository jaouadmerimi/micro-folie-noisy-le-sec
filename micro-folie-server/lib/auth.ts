import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { drizzle } from 'drizzle-orm/node-postgres';
import { bearer } from 'better-auth/plugins/bearer';
import * as schema from './schema.ts';
import { Service, type Bindings } from './service.ts';
import { getPool } from './database.ts';
export function makeAuth(env: Bindings) {
  if (!env.AUTH_SECRET || !env.SITE_URL)
    throw new Error('Authentication configuration missing');
  return betterAuth({
    appName: 'Micro-Folie Noisy-le-Sec',
    baseURL: env.API_URL,
    secret: env.AUTH_SECRET,
    database: drizzleAdapter(drizzle(getPool(), { schema }), {
      provider: 'pg',
      schema,
      transaction: true,
    }),
    trustedOrigins: [env.SITE_URL, new URL(env.SITE_URL).origin],
    plugins: [bearer({ requireSignature: true })],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      // Signup is exposed only through single-use invitation validation, never through the public auth handler.
      sendResetPassword: async ({ user, url }) => {
        const service = new Service(env);
        const cfg = await service.mailConfig();
        if (!cfg.key || !cfg.from)
          throw new Error('Email service is not configured');
        await service.queueMail(
          user.email,
          'Votre mot de passe Micro-Folie',
          `Pour choisir un nouveau mot de passe, ouvrez ce lien (valable une heure) :\n${url}\n\nSi vous n’avez pas demandé ce changement, ignorez ce message.`,
        );
        await service.flushMail();
      },
    },
    session: {
      expiresIn: 8 * 3600,
      updateAge: 3600,
      cookieCache: { enabled: false },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      useSecureCookies: env.SITE_URL.startsWith('https:'),
      defaultCookieAttributes: { sameSite: 'lax', httpOnly: true },
    },
    rateLimit: { enabled: true, window: 60, max: 20 },
  });
}
