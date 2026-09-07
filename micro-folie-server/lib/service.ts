import type { Database, FileStore } from './database.ts';
export interface Bindings {
  DB: Database;
  FILES: FileStore;
  ADMIN_EMAIL?: string;
  SITE_URL?: string;
  API_URL?: string;
  ENCRYPTION_KEY?: string;
  AUTH_SECRET?: string;
  BOOTSTRAP_HASH?: string;
  BOOTSTRAP_EXPIRES?: string;
}
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export const now = () => new Date().toISOString();
export const uuid = () => crypto.randomUUID();
export const categories = [
  'Famille',
  'FabLab',
  'Cuisine',
  'Jardin',
  'Musée numérique',
  'Événement',
];
export const activeSeats =
  "(status='confirmed' OR (status='pending' AND hold_until > ?))";
export function str(
  v: unknown,
  label: string,
  max = 200,
  required = true,
): string {
  if (typeof v !== 'string' || v.length > max || (required && !v.trim()))
    throw new HttpError(400, `${label} : valeur manquante ou trop longue.`);
  return v.trim();
}
export function email(v: unknown) {
  const s = str(v, 'Email', 254).toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s))
    throw new HttpError(400, 'Adresse email invalide.');
  return s;
}
export function integer(v: unknown, label: string, min: number, max: number) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new HttpError(
      400,
      `${label} doit être compris entre ${min} et ${max}.`,
    );
  return n;
}
export function choice(v: unknown, values: string[]) {
  if (typeof v !== 'string' || !values.includes(v))
    throw new HttpError(400, 'Choix invalide.');
  return v;
}
export function date(v: unknown) {
  const s = str(v, 'Date', 40);
  if (
    !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(s) ||
    !Number.isFinite(Date.parse(s))
  )
    throw new HttpError(400, 'Date invalide.');
  return new Date(s).toISOString();
}
export function safeUrl(v: unknown) {
  const s = str(v ?? '', 'Lien', 1500, false);
  if (s) {
    try {
      const u = new URL(s);
      if (u.protocol !== 'https:' || u.username || u.password) throw 0;
    } catch {
      throw new HttpError(400, 'Le lien doit commencer par https://.');
    }
  }
  return s;
}
export async function hash(s: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
export const token = () =>
  [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
export function publicStatus(r: any) {
  return r.status === 'pending' && r.hold_until <= now() ? 'expired' : r.status;
}
export class Service {
  env: Bindings;
  db: Database;
  transport: typeof fetch;
  constructor(env: Bindings, transport: typeof fetch = fetch) {
    this.env = env;
    this.db = env.DB;
    this.transport = transport;
  }
  q(sql: string, ...args: any[]) {
    return this.db.prepare(sql).bind(...args);
  }
  async all(sql: string, ...args: any[]) {
    return (await this.q(sql, ...args).all()).results as any[];
  }
  owner(user: { email: string } | null) {
    return (
      !!user &&
      !!this.env.ADMIN_EMAIL &&
      user.email.toLowerCase() === this.env.ADMIN_EMAIL.toLowerCase()
    );
  }
  async authorize(user: { email: string; id: string } | null) {
    if (!user) throw new HttpError(401, 'Connectez-vous à l’administration.');
    if (
      !this.owner(user) &&
      !(await this.q(
        'SELECT email FROM admins WHERE email=?',
        user.email.toLowerCase(),
      ).first())
    )
      throw new HttpError(403, 'Ce compte n’a pas accès à l’administration.');
    return user;
  }
  audit(actor: string, action: string, target: string) {
    return this.q(
      'INSERT INTO audit (id,actor,action,target,created_at) VALUES (?,?,?,?,?)',
      uuid(),
      actor,
      action,
      target,
      now(),
    );
  }
  async limit(key: string, max = 12) {
    const ts = now(),
      until = new Date(Date.now() + 3600000).toISOString();
    const r = await this.q(
      'INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<=? THEN 1 ELSE rate_limits.count+1 END,expires_at=CASE WHEN rate_limits.expires_at<=? THEN excluded.expires_at ELSE rate_limits.expires_at END RETURNING count',
      key,
      until,
      ts,
      ts,
    ).first<{ count: number }>();
    if ((r?.count ?? max + 1) > max)
      throw new HttpError(
        429,
        'Trop de demandes. Réessayez dans une heure ou contactez l’équipe.',
      );
  }
  async publicData() {
    const ts = now();
    return {
      workshops: await this.all(
        `SELECT w.*,w.capacity-COALESCE((SELECT SUM(participants) FROM reservations r WHERE r.workshop_id=w.id AND ${activeSeats}),0) AS remaining FROM workshops w WHERE w.status='published' AND w.starts_at>? ORDER BY w.starts_at`,
        ts,
        ts,
      ),
      news: await this.all(
        "SELECT id,title,body,image_key,link,published_at FROM news WHERE status='published' AND published_at<=? ORDER BY published_at DESC LIMIT 12",
        ts,
      ),
    };
  }
  async createReservation(d: any) {
    const wid = str(d.workshopId, 'Atelier', 50),
      first = str(d.firstName, 'Prénom', 80),
      last = str(d.lastName, 'Nom', 80),
      to = email(d.email),
      phone = str(d.phone ?? '', 'Téléphone', 35, false),
      qty = integer(d.participants, 'Participants', 1, 10),
      t = str(d.token, 'Clé', 100),
      key = str(d.requestKey, 'Identifiant de demande', 100);
    if (
      !/^[a-f0-9]{64}$/.test(t) ||
      !/^[a-f0-9-]{36}$/.test(key) ||
      d.consent !== true ||
      d.website
    )
      throw new HttpError(
        400,
        'Vérifiez le formulaire et l’accord de traitement des coordonnées.',
      );
    const th = await hash(t),
      old: any = await this.q(
        'SELECT reference,status,hold_until,token_hash FROM reservations WHERE request_key=?',
        key,
      ).first();
    if (old) {
      if (old.token_hash !== th)
        throw new HttpError(409, 'Identifiant déjà utilisé.');
      return {
        reference: old.reference,
        status: publicStatus(old),
        holdUntil: old.hold_until,
      };
    }
    await this.limit('email:' + (await hash(to)), 8);
    const w: any = await this.q(
      "SELECT * FROM workshops WHERE id=? AND status='published' AND starts_at>?",
      wid,
      now(),
    ).first();
    if (!w)
      throw new HttpError(
        409,
        'Cet atelier n’est plus ouvert aux réservations.',
      );
    if (qty > w.capacity)
      throw new HttpError(
        400,
        'Le groupe dépasse la capacité de l’atelier. Contactez l’équipe.',
      );
    const ts = now(),
      hold = new Date(
        Math.min(Date.now() + 48 * 3600000, Date.parse(w.starts_at)),
      ).toISOString(),
      id = uuid(),
      ref = 'MF-' + uuid().replaceAll('-', '').slice(0, 10).toUpperCase();
    const insert = this.q(
      `INSERT INTO reservations (id,reference,workshop_id,first_name,last_name,email,phone,participants,status,hold_until,token_hash,request_key,created_at,updated_at,version) SELECT ?,?,?,?,?,?,?,?,CASE WHEN w.capacity-COALESCE((SELECT SUM(participants) FROM reservations WHERE workshop_id=w.id AND ${activeSeats}),0)>=? THEN 'pending' ELSE 'waitlist' END,?,?,?,?,?,1 FROM workshops w WHERE w.id=? AND w.status='published' AND w.starts_at>? AND ?<=w.capacity AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.workshop_id=w.id AND r.email=? AND (r.status IN ('confirmed','waitlist') OR (r.status='pending' AND r.hold_until>?)))`,
      id,
      ref,
      wid,
      first,
      last,
      to,
      phone,
      qty,
      ts,
      qty,
      hold,
      th,
      key,
      ts,
      ts,
      wid,
      ts,
      qty,
      to,
      ts,
    );
    const body = `Bonjour ${first},\n\nVotre demande ${ref} pour « ${w.title} » (${qty} personne(s)) est enregistrée. Ce n’est pas encore une confirmation.\n\nL’équipe vérifiera les disponibilités. Si l’atelier est complet, votre demande rejoint la liste d’attente. Les places en attente de validation sont retenues au maximum 48 heures, jusqu’au début de l’atelier.\n\nConsulter le statut ou annuler : ${this.env.SITE_URL}/reservation#${t}\n\nMicro-Folie de Noisy-le-Sec`;
    const mail = this.q(
      "INSERT INTO outbox (id,reservation_id,to_email,subject,body,status,attempts,last_error,created_at,locked_until) SELECT ?,id,email,?,?,'pending',0,'',?,'' FROM reservations WHERE id=?",
      uuid(),
      'Votre demande · ' + ref,
      body,
      ts,
      id,
    );
    let result;
    try {
      result = await this.db.batch([insert, mail]);
    } catch (e) {
      if (String(e).includes('UNIQUE'))
        throw new HttpError(
          409,
          'Demande déjà enregistrée. Utilisez votre lien de suivi.',
        );
      throw e;
    }
    if (!result[0].meta.changes)
      throw new HttpError(
        409,
        'Une demande existe déjà avec cet email, ou l’atelier a changé. Contactez l’équipe.',
      );
    const r: any = await this.q(
      'SELECT status FROM reservations WHERE id=?',
      id,
    ).first();
    try {
      await this.flushMail(id);
    } catch {
      /* durable outbox */
    }
    const m: any = await this.q(
      'SELECT status FROM outbox WHERE reservation_id=?',
      id,
    ).first();
    return {
      reference: ref,
      status: r.status,
      holdUntil: hold,
      emailSent: m?.status === 'sent',
    };
  }
  async lookupReservation(t: string) {
    if (!/^[a-f0-9]{64}$/.test(t)) throw new HttpError(404, 'Lien invalide.');
    const r: any = await this.q(
      'SELECT r.id,r.reference,r.status,r.hold_until,r.participants,r.version,w.title,w.starts_at,w.ends_at FROM reservations r JOIN workshops w ON w.id=r.workshop_id WHERE r.token_hash=?',
      await hash(t),
    ).first();
    if (!r) throw new HttpError(404, 'Réservation introuvable.');
    return { ...r, status: publicStatus(r) };
  }
  async cancelReservation(t: string) {
    const r = await this.lookupReservation(t);
    if (r.status === 'cancelled') return { ok: true };
    const ts = now();
    await this.db.batch([
      this.q(
        "UPDATE reservations SET status='cancelled',version=version+1,updated_at=? WHERE id=? AND version=? AND status IN ('pending','confirmed','waitlist')",
        ts,
        r.id,
        r.version,
      ),
      this.q(
        "INSERT INTO outbox (id,reservation_id,to_email,subject,body,status,attempts,last_error,created_at,locked_until) SELECT ?,id,email,?,?,'pending',0,'',?,'' FROM reservations WHERE id=? AND version=? AND status='cancelled' AND updated_at=? AND changes()=1",
        uuid(),
        'Annulation · ' + r.reference,
        `Votre réservation ${r.reference} pour « ${r.title} » est annulée.\n\nÀ bientôt à la Micro-Folie.`,
        ts,
        r.id,
        r.version + 1,
        ts,
      ),
    ]);
    try {
      await this.flushMail(r.id);
    } catch {}
    return { ok: true };
  }
  async adminData(user: { email: string; id: string }) {
    await this.authorize(user);
    const cfg = await this.mailConfig();
    return {
      workshops: await this.all(
        `SELECT w.*,COALESCE((SELECT SUM(participants) FROM reservations WHERE workshop_id=w.id AND ${activeSeats}),0) AS occupied FROM workshops w ORDER BY starts_at DESC`,
        now(),
      ),
      reservations: (
        await this.all(
          'SELECT r.id,r.reference,r.workshop_id,r.first_name,r.last_name,r.email,r.phone,r.participants,r.status,r.hold_until,r.created_at,r.version,w.title,w.starts_at FROM reservations r JOIN workshops w ON w.id=r.workshop_id ORDER BY r.created_at DESC LIMIT 1000',
        )
      ).map((r) => ({ ...r, status: publicStatus(r) })),
      news: await this.all('SELECT * FROM news ORDER BY published_at DESC'),
      mail: await this.all(
        "SELECT id,reservation_id,subject,status,attempts,last_error,created_at FROM outbox WHERE status!='sent' ORDER BY created_at LIMIT 100",
      ),
      emailConfigured: !!(cfg.key && cfg.from),
      emailFrom: cfg.from,
      isOwner: this.owner(user),
      admins: this.owner(user)
        ? await this.all('SELECT email FROM admins ORDER BY email')
        : [],
      ownerEmail: this.owner(user) ? this.env.ADMIN_EMAIL : undefined,
    };
  }
  async saveWorkshop(d: any, actor: string) {
    const id = d.id ? str(d.id, 'Identifiant', 50) : uuid(),
      title = str(d.title, 'Titre', 180),
      description = str(d.description, 'Description', 5000),
      category = choice(d.category, categories),
      start = date(d.starts_at),
      end = date(d.ends_at),
      capacity = integer(d.capacity, 'Capacité', 1, 500),
      age = integer(d.min_age, 'Âge minimum', 0, 110),
      status = choice(d.status, ['draft', 'published', 'archived']),
      ts = now();
    if (end <= start)
      throw new HttpError(400, 'La fin doit être après le début.');
    if (status === 'published' && start <= ts)
      throw new HttpError(400, 'Choisissez une date future avant de publier.');
    if (!d.id) {
      await this.db.batch([
        this.q(
          'INSERT INTO workshops (id,title,description,category,starts_at,ends_at,capacity,min_age,status,updated_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,1)',
          id,
          title,
          description,
          category,
          start,
          end,
          capacity,
          age,
          status,
          ts,
        ),
        this.audit(actor, 'create_workshop', id),
      ]);
    } else {
      const old: any = await this.q(
        'SELECT * FROM workshops WHERE id=?',
        id,
      ).first();
      if (!old) throw new HttpError(404, 'Atelier introuvable.');
      const active: any = await this.q(
        `SELECT COUNT(*) AS n FROM reservations WHERE workshop_id=? AND (status='waitlist' OR ${activeSeats})`,
        id,
        ts,
      ).first();
      if (
        active.n &&
        (old.starts_at !== start ||
          old.ends_at !== end ||
          old.title !== title ||
          status !== 'published')
      )
        throw new HttpError(
          409,
          'Traitez les demandes actives avant de changer le titre, les horaires ou la publication de cet atelier.',
        );
      const result = await this.db.batch([
        this.q(
          `UPDATE workshops SET title=?,description=?,category=?,starts_at=?,ends_at=?,capacity=?,min_age=?,status=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND ((starts_at=? AND ends_at=? AND title=? AND status=?) OR NOT EXISTS (SELECT 1 FROM reservations WHERE workshop_id=? AND (status='waitlist' OR status='confirmed' OR (status='pending' AND hold_until>?)))) AND ?>=COALESCE((SELECT SUM(participants) FROM reservations WHERE workshop_id=? AND ${activeSeats}),0)`,
          title,
          description,
          category,
          start,
          end,
          capacity,
          age,
          status,
          ts,
          id,
          integer(d.version, 'Version', 1, 1000000),
          start,
          end,
          title,
          status,
          id,
          ts,
          capacity,
          id,
          ts,
        ),
        this.audit(actor, 'update_workshop', id),
      ]);
      if (!result[0].meta.changes)
        throw new HttpError(
          409,
          'L’atelier a changé ou la capacité est inférieure aux places occupées. Rechargez.',
        );
    }
    return { id };
  }
  async decide(d: any, actor: string) {
    const id = str(d.id, 'Réservation', 50),
      target = choice(d.status, ['confirmed', 'refused', 'cancelled']),
      version = integer(d.version, 'Version', 1, 1000000),
      ts = now();
    const r: any = await this.q(
      'SELECT r.*,w.title,w.starts_at FROM reservations r JOIN workshops w ON w.id=r.workshop_id WHERE r.id=?',
      id,
    ).first();
    if (!r) throw new HttpError(404, 'Réservation introuvable.');
    const allowed =
      target === 'confirmed'
        ? "r.status IN ('pending','waitlist') AND (r.status!='pending' OR r.hold_until>?) AND EXISTS (SELECT 1 FROM workshops w WHERE w.id=r.workshop_id AND w.status='published' AND w.starts_at>? AND w.capacity>=r.participants+COALESCE((SELECT SUM(participants) FROM reservations others WHERE others.workshop_id=w.id AND others.id!=r.id AND (others.status='confirmed' OR (others.status='pending' AND others.hold_until>?))),0))"
        : "r.status IN ('pending','waitlist','confirmed')";
    const title =
      target === 'confirmed'
        ? 'Réservation confirmée'
        : target === 'refused'
          ? 'Demande non retenue'
          : 'Réservation annulée';
    const body = `${title} · ${r.reference}\n\nBonjour ${r.first_name},\n\n${target === 'confirmed' ? `L’équipe confirme ${r.participants} place(s)` : 'L’équipe ne peut pas maintenir votre demande'} pour « ${r.title} », le ${new Date(r.starts_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' })}.\n\nConservez votre lien de suivi pour consulter la réservation ou l’annuler.\n\nMicro-Folie · 53 rue de Merlan, Noisy-le-Sec\n01 49 42 67 19`;
    const result = await this.db.batch([
      this.q(
        `UPDATE reservations AS r SET status=?,version=version+1,updated_at=? WHERE id=? AND version=? AND ${allowed}`,
        target,
        ts,
        id,
        version,
        ...(target === 'confirmed' ? [ts, ts, ts] : []),
      ),
      this.q(
        "INSERT INTO outbox (id,reservation_id,to_email,subject,body,status,attempts,last_error,created_at,locked_until) SELECT ?,id,email,?,?,'pending',0,'',?,'' FROM reservations WHERE id=? AND version=? AND status=? AND updated_at=? AND changes()=1",
        uuid(),
        title + ' · ' + r.reference,
        body,
        ts,
        id,
        version + 1,
        target,
        ts,
      ),
      this.audit(actor, 'reservation_' + target, id),
    ]);
    if (!result[0].meta.changes)
      throw new HttpError(
        409,
        'Demande modifiée, délai expiré ou places insuffisantes. Rechargez la liste.',
      );
    try {
      await this.flushMail(id);
    } catch {}
    return { ok: true };
  }
  async saveNews(d: any, actor: string) {
    const id = d.id ? str(d.id, 'Identifiant', 50) : uuid(),
      title = str(d.title, 'Titre', 180),
      body = str(d.body, 'Texte', 12000),
      link = safeUrl(d.link),
      image = str(d.image_key ?? '', 'Photo', 60, false),
      status = choice(d.status, ['draft', 'published', 'archived']),
      published = date(d.published_at),
      ts = now();
    if (
      image &&
      (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(image) ||
        !(await this.env.FILES.head(image)))
    )
      throw new HttpError(400, 'Photo indisponible.');
    const query = d.id
      ? this.q(
          'UPDATE news SET title=?,body=?,image_key=?,link=?,status=?,published_at=?,updated_at=?,version=version+1 WHERE id=? AND version=?',
          title,
          body,
          image,
          link,
          status,
          published,
          ts,
          id,
          integer(d.version, 'Version', 1, 1000000),
        )
      : this.q(
          'INSERT INTO news (id,title,body,image_key,link,status,published_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?,1)',
          id,
          title,
          body,
          image,
          link,
          status,
          published,
          ts,
        );
    const r = await this.db.batch([query, this.audit(actor, 'save_news', id)]);
    if (!r[0].meta.changes)
      throw new HttpError(409, 'Cette actualité a changé. Rechargez.');
    return { id };
  }
  async crypt(value: string, decrypt = false) {
    if (!this.env.ENCRYPTION_KEY)
      throw new HttpError(503, 'Protection des paramètres non configurée.');
    const bytes = Uint8Array.from(atob(this.env.ENCRYPTION_KEY), (c) =>
        c.charCodeAt(0),
      ),
      key = await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, [
        'encrypt',
        'decrypt',
      ]);
    if (decrypt) {
      const p = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
      return new TextDecoder().decode(
        await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: p.slice(0, 12) },
          key,
          p.slice(12),
        ),
      );
    }
    const iv = crypto.getRandomValues(new Uint8Array(12)),
      body = new Uint8Array(
        await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          new TextEncoder().encode(value),
        ),
      );
    return btoa(String.fromCharCode(...iv, ...body));
  }
  async mailConfig() {
    const rows = await this.all(
        "SELECT key,value FROM settings WHERE key IN ('mail_key','mail_from')",
      ),
      cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      key: cfg.mail_key ? await this.crypt(cfg.mail_key, true) : '',
      from: cfg.mail_from ?? '',
    };
  }
  async saveMailConfig(d: any) {
    const from = email(d.from),
      key = str(d.key ?? '', 'Clé Resend', 200, false);
    if (key && !/^re_[a-zA-Z0-9_]+$/.test(key))
      throw new HttpError(400, 'Clé Resend invalide.');
    const stmts = [
      this.q(
        'INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        'mail_from',
        from,
      ),
    ];
    if (key)
      stmts.push(
        this.q(
          'INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
          'mail_key',
          await this.crypt(key),
        ),
      );
    await this.db.batch(stmts);
    return { ok: true };
  }
  async queueMail(to: string, subject: string, body: string) {
    await this.q(
      "INSERT INTO outbox (id,to_email,subject,body,status,attempts,last_error,created_at,locked_until) VALUES (?,?,?,?,'pending',0,'',?,'')",
      uuid(),
      to,
      subject,
      body,
      now(),
    ).run();
  }
  async flushMail(reservationId?: string) {
    const cfg = await this.mailConfig();
    if (!cfg.key || !cfg.from) return { sent: 0, pending: true };
    const rows = await this.all(
      `SELECT id FROM outbox WHERE (status='pending' OR (status='sending' AND locked_until<?)) ${reservationId ? 'AND reservation_id=?' : ''} ORDER BY created_at LIMIT 10`,
      now(),
      ...(reservationId ? [reservationId] : []),
    );
    let sent = 0;
    for (const row of rows) {
      const m: any = await this.q(
        "UPDATE outbox SET status='sending',locked_until=?,attempts=attempts+1 WHERE id=? AND (status='pending' OR (status='sending' AND locked_until<?)) RETURNING *",
        new Date(Date.now() + 60000).toISOString(),
        row.id,
        now(),
      ).first();
      if (!m) continue;
      try {
        const r = await this.transport('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + cfg.key,
            'Content-Type': 'application/json',
            'Idempotency-Key': 'micro-folie-' + m.id,
          },
          body: JSON.stringify({
            from: `Micro-Folie <${cfg.from}>`,
            to: [m.to_email],
            subject: m.subject,
            text: m.body,
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok)
          throw new Error(
            'Envoi refusé par Resend (HTTP ' +
              r.status +
              '). Vérifiez la clé et le domaine expéditeur.',
          );
        await this.q(
          "UPDATE outbox SET status='sent',last_error='',body='',locked_until='' WHERE id=?",
          m.id,
        ).run();
        sent++;
      } catch (e) {
        await this.q(
          "UPDATE outbox SET status='pending',last_error=?,locked_until='' WHERE id=?",
          e instanceof Error && e.message.startsWith('Envoi refusé')
            ? e.message
            : 'Envoi interrompu. Réessayez.',
          m.id,
        ).run();
      }
    }
    return { sent };
  }
}
