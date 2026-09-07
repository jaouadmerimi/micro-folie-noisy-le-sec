import { env } from 'cloudflare:workers';
import { makeAuth } from '../../../lib/auth';
import {
  Service,
  HttpError,
  hash,
  token,
  uuid,
  now,
  email,
  str,
  type Bindings,
} from '../../../lib/service';
export const dynamic = 'force-dynamic';
const bindings = () => env as unknown as Bindings;
function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
function origin(req: Request) {
  if (req.headers.get('origin') !== bindings().SITE_URL)
    throw new HttpError(403, 'Origine de la demande refusée.');
}
async function bytes(req: Request, max: number) {
  if (Number(req.headers.get('content-length') ?? 0) > max)
    throw new HttpError(413, 'Demande trop volumineuse.');
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, 'Demande trop volumineuse.');
    }
    chunks.push(part.value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
async function body(req: Request) {
  if (!req.headers.get('content-type')?.startsWith('application/json'))
    throw new HttpError(415, 'Format non accepté.');
  const text = new TextDecoder().decode(await bytes(req, 30000));
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Demande invalide.');
  }
}
async function handle(req: Request) {
  const e = bindings(),
    s = new Service(e),
    path = new URL(req.url).pathname.replace(/^\/api\//, '');
  try {
    if (req.method !== 'GET') origin(req);
    if (path === 'public' && req.method === 'GET')
      return json(await s.publicData());
    if (path.startsWith('auth/')) {
      const endpoint = path.slice(5);
      if (
        ![
          'sign-in/email',
          'sign-out',
          'get-session',
          'request-password-reset',
          'reset-password',
          'change-password',
        ].includes(endpoint)
      )
        throw new HttpError(404, 'Route introuvable.');
      if (req.method === 'POST')
        await s.limit(
          'auth-ip:' +
            (await hash(req.headers.get('cf-connecting-ip') ?? 'shared')),
          60,
        );
      const response = await makeAuth(e).handler(req);
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }
    if (path === 'reservations' && req.method === 'POST') {
      await s.limit(
        'booking-ip:' +
          (await hash(req.headers.get('cf-connecting-ip') ?? 'shared')),
        60,
      );
      return json(await s.createReservation(await body(req)), 201);
    }
    if (path === 'reservation' && req.method === 'POST') {
      const d = await body(req);
      await s.limit(
        'lookup-ip:' +
          (await hash(req.headers.get('cf-connecting-ip') ?? 'shared')),
        120,
      );
      return json(
        d.action === 'cancel'
          ? await s.cancelReservation(str(d.token, 'Lien', 100))
          : await s.lookupReservation(str(d.token, 'Lien', 100)),
      );
    }
    if (path === 'activate' && req.method === 'POST') {
      await s.limit(
        'activate-ip:' +
          (await hash(req.headers.get('cf-connecting-ip') ?? 'shared')),
        20,
      );
      const d = await body(req),
        t = str(d.token, 'Lien d’activation', 100),
        name = str(d.name, 'Nom', 100),
        password = str(d.password, 'Mot de passe', 128);
      if (password.length < 12)
        throw new HttpError(
          400,
          'Choisissez un mot de passe d’au moins 12 caractères.',
        );
      const th = await hash(t);
      let to: string, claim: string;
      if (
        e.BOOTSTRAP_HASH &&
        th === e.BOOTSTRAP_HASH &&
        e.BOOTSTRAP_EXPIRES &&
        now() < e.BOOTSTRAP_EXPIRES
      ) {
        to = email(e.ADMIN_EMAIL);
        const inserted = await s
          .q(
            "INSERT INTO settings (key,value) VALUES ('owner_created','claimed') ON CONFLICT(key) DO NOTHING RETURNING key",
          )
          .first();
        if (!inserted)
          throw new HttpError(
            409,
            'Le premier compte est déjà activé. Connectez-vous.',
          );
        claim = 'owner';
      } else {
        const invite: any = await s
          .q(
            'UPDATE invitations SET consumed=1 WHERE token_hash=? AND consumed=0 AND expires_at>? RETURNING *',
            th,
            now(),
          )
          .first();
        if (!invite)
          throw new HttpError(
            403,
            'Ce lien est invalide, expiré ou déjà utilisé.',
          );
        to = invite.email;
        claim = invite.id;
      }
      try {
        await makeAuth(e).api.signUpEmail({
          body: { email: to, password, name },
        });
      } catch (error) {
        if (claim === 'owner')
          await s.q("DELETE FROM settings WHERE key='owner_created'").run();
        else
          await s
            .q('UPDATE invitations SET consumed=0 WHERE id=?', claim)
            .run();
        throw new HttpError(
          400,
          'Activation impossible. Ce compte existe peut-être déjà. Essayez de vous connecter.',
        );
      }
      return json({ ok: true, email: to });
    }
    if (path.startsWith('image/') && req.method === 'GET') {
      const key = path.slice(6);
      if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key))
        throw new HttpError(404, 'Photo introuvable.');
      const published = await s
        .q(
          "SELECT id FROM news WHERE image_key=? AND status='published' AND published_at<=?",
          key,
          now(),
        )
        .first();
      if (!published) {
        const session = await makeAuth(e).api.getSession({
          headers: req.headers,
        });
        await s.authorize(session?.user ?? null);
      }
      const file = await e.FILES.get(key);
      if (!file) throw new HttpError(404, 'Photo introuvable.');
      return new Response(file.body, {
        headers: {
          'Content-Type':
            file.httpMetadata?.contentType ?? 'application/octet-stream',
          'Cache-Control': published ? 'public,max-age=3600' : 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    const session = await makeAuth(e).api.getSession({ headers: req.headers }),
      user = await s.authorize(session?.user ?? null);
    if (path === 'admin' && req.method === 'GET')
      return json(await s.adminData(user));
    if (path === 'upload' && req.method === 'POST') {
      if (Number(req.headers.get('content-length') ?? 0) > 3 * 1024 * 1024)
        throw new HttpError(413, 'Photo limitée à 3 Mo.');
      const imageBytes = await bytes(req, 3 * 1024 * 1024);
      if (imageBytes.length < 12) throw new HttpError(400, 'Photo invalide.');
      let ext = '',
        mime = '';
      if (
        imageBytes[0] === 255 &&
        imageBytes[1] === 216 &&
        imageBytes[2] === 255
      ) {
        ext = 'jpg';
        mime = 'image/jpeg';
      } else if (
        imageBytes
          .slice(0, 8)
          .every((b, i) => b === [137, 80, 78, 71, 13, 10, 26, 10][i])
      ) {
        ext = 'png';
        mime = 'image/png';
      } else if (
        new TextDecoder().decode(imageBytes.slice(0, 4)) === 'RIFF' &&
        new TextDecoder().decode(imageBytes.slice(8, 12)) === 'WEBP'
      ) {
        ext = 'webp';
        mime = 'image/webp';
      } else
        throw new HttpError(400, 'Choisissez une photo JPEG, PNG ou WebP.');
      const key = uuid() + '.' + ext;
      await e.FILES.put(key, imageBytes, {
        httpMetadata: { contentType: mime },
      });
      return json({ key });
    }
    if (req.method !== 'POST') throw new HttpError(404, 'Route introuvable.');
    const d = await body(req);
    if (path === 'admin/workshops')
      return json(await s.saveWorkshop(d, user.email));
    if (path === 'admin/news') return json(await s.saveNews(d, user.email));
    if (path === 'admin/reservations')
      return json(await s.decide(d, user.email));
    if (path === 'admin/mail/retry') return json(await s.flushMail());
    if (!s.owner(user))
      throw new HttpError(403, 'Cette action est réservée au responsable.');
    if (path === 'admin/mail/config') return json(await s.saveMailConfig(d));
    if (path === 'admin/invite') {
      const to = email(d.email);
      if (to === e.ADMIN_EMAIL?.toLowerCase())
        throw new HttpError(400, 'Ce compte est déjà responsable.');
      const t = token(),
        ts = now();
      await s.db.batch([
        s.q(
          'INSERT INTO admins (email,created_at,created_by) VALUES (?,?,?) ON CONFLICT(email) DO NOTHING',
          to,
          ts,
          user.email,
        ),
        s.q(
          'INSERT INTO invitations (id,email,token_hash,expires_at,consumed) VALUES (?,?,?,?,0)',
          uuid(),
          to,
          await hash(t),
          new Date(Date.now() + 7 * 86400000).toISOString(),
        ),
        s.audit(user.email, 'invite', to),
      ]);
      return json({ url: e.SITE_URL + '/admin/activation#' + t });
    }
    if (path === 'admin/revoke') {
      const to = email(d.email);
      if (to === e.ADMIN_EMAIL?.toLowerCase())
        throw new HttpError(
          400,
          'Le responsable ne peut pas retirer son propre accès.',
        );
      await s.db.batch([
        s.q('DELETE FROM admins WHERE email=?', to),
        s.q('DELETE FROM invitations WHERE email=?', to),
        s.q(
          'DELETE FROM session WHERE user_id IN (SELECT id FROM user WHERE email=?)',
          to,
        ),
        s.audit(user.email, 'revoke', to),
      ]);
      return json({ ok: true });
    }
    throw new HttpError(404, 'Route introuvable.');
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    console.error(
      'Micro-Folie API failure',
      path,
      error instanceof Error ? error.name : 'Error',
    );
    return json(
      {
        error:
          'Le service est momentanément indisponible. Réessayez sans fermer votre page.',
      },
      503,
    );
  }
}
export const GET = handle;
export const POST = handle;
