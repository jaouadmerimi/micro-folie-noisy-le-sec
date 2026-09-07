import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { Service, type Bindings } from './service';
export function makeAuth(env: Bindings) {
  if (!env.AUTH_SECRET || !env.SITE_URL)
    throw new Error('Authentication configuration missing');
  return betterAuth({
    appName: 'Micro-Folie Noisy-le-Sec',
    baseURL: env.SITE_URL,
    secret: env.AUTH_SECRET,
    database: drizzleAdapter(drizzle(env.DB, { schema }), {
      provider: 'sqlite',
      schema,
      transaction: false,
    }),
    trustedOrigins: [env.SITE_URL],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
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
      useSecureCookies: env.SITE_URL.startsWith('https:'),
      defaultCookieAttributes: { sameSite: 'lax', httpOnly: true },
    },
    rateLimit: { enabled: true, window: 60, max: 20 },
  });
}
