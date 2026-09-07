'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { NativeSelect } from './ui/native-select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  CalendarDays,
  Users,
  Newspaper,
  Mail,
  Plus,
  LogOut,
  ArrowUpRight,
  RefreshCw,
  Printer,
} from 'lucide-react';
import { parisInput, parisToUTC, formatDate } from '../lib/dates';
const labels: Record<string, string> = {
  pending: 'À confirmer',
  waitlist: 'Liste d’attente',
  confirmed: 'Confirmée',
  refused: 'Refusée',
  cancelled: 'Annulée',
  expired: 'Délai expiré',
  draft: 'Brouillon',
  published: 'Publié',
  archived: 'Archivé',
};
import { api, apiFetch } from '../lib/http';
import { sitePath } from '../lib/urls';
import { PrivateImage } from './private-image';
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={'field-label ' + (wide ? 'wide' : '')}>
      {label}
      {children}
    </label>
  );
}
function Badge({ status }: { status: string }) {
  return <span className={'status ' + status}>{labels[status] ?? status}</span>;
}
export default function AdminClient() {
  const [data, setData] = useState<any>(null),
    [user, setUser] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState('reservations');
  const [workshop, setWorkshop] = useState<any>(null),
    [news, setNews] = useState<any>(null),
    [filter, setFilter] = useState(''),
    [status, setStatus] = useState(''),
    [search, setSearch] = useState(''),
    [invite, setInvite] = useState('');
  async function refresh() {
    const result = await api('admin');
    setData(result);
  }
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const session = await api('auth/get-session');
        if (!live) return;
        if (session?.user) {
          setUser(session.user);
          const result = await api('admin');
          if (live) setData(result);
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  async function act(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await act(async () => {
      await api('auth/sign-in/email', {
        email: f.get('email'),
        password: f.get('password'),
        rememberMe: false,
      });
      const session = await api('auth/get-session');
      setUser(session.user);
      await refresh();
    });
  }
  async function logout() {
    await act(async () => {
      await api('auth/sign-out', {});
      setData(null);
      setUser(null);
    });
  }
  if (loading)
    return (
      <main className="admin-login">
        <p role="status">Ouverture de l’espace équipe…</p>
      </main>
    );
  if (!data)
    return (
      <main className="admin-login">
        <div className="brand-mark">▦</div>
        <p className="eyebrow">MICRO-FOLIE · NOISY-LE-SEC</p>
        <h1>L’espace de l’équipe</h1>
        <p>Ateliers, réservations et actualités.</p>
        <section className="panel">
          <h2>Connexion</h2>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {user ? (
            <>
              <p>
                Connecté avec {user.email}. Ce compte n’a pas accès à
                l’administration, ou le service est indisponible.
              </p>
              <Button onClick={() => act(refresh)} disabled={busy}>
                Réessayer
              </Button>
              <Button variant="outline" onClick={logout} disabled={busy}>
                Se déconnecter
              </Button>
            </>
          ) : (
            <form onSubmit={login} className="form-grid">
              <Field label="Email">
                <Input
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                />
              </Field>
              <Field label="Mot de passe">
                <Input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </Field>
              <Button className="wide" type="submit" disabled={busy}>
                {busy ? 'Connexion…' : 'Se connecter'}
              </Button>
              <a href={sitePath('/admin/mot-de-passe/')} className="wide text-link">
                Mot de passe oublié ?
              </a>
            </form>
          )}
        </section>
        <a href={sitePath('/')}>← Retour au site</a>
      </main>
    );
  const rows = data.reservations.filter(
    (r: any) =>
      (!filter || r.workshop_id === filter) &&
      (!status || r.status === status) &&
      (!search ||
        `${r.first_name} ${r.last_name} ${r.email} ${r.reference}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const pending = data.reservations.filter(
      (r: any) => r.status === 'pending',
    ).length,
    waiting = data.reservations.filter(
      (r: any) => r.status === 'waitlist',
    ).length;
  async function saveWorkshop(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    await act(async () => {
      await api('admin/workshops', {
        ...fields,
        id: workshop.id,
        version: workshop.version,
        starts_at: parisToUTC(String(fields.starts_at)),
        ends_at: parisToUTC(String(fields.ends_at)),
      });
      setWorkshop(null);
      await refresh();
      setNotice('Atelier enregistré.');
    });
  }
  async function saveNews(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    await act(async () => {
      await api('admin/news', {
        ...fields,
        id: news.id,
        version: news.version,
        image_key: news.image_key ?? '',
        published_at: parisToUTC(String(fields.published_at)),
      });
      setNews(null);
      await refresh();
      setNotice('Actualité enregistrée.');
    });
  }
  async function decide(r: any, value: string) {
    if (
      !window.confirm(
        `${value === 'confirmed' ? 'Confirmer' : value === 'refused' ? 'Refuser' : 'Annuler'} la demande ${r.reference} de ${r.first_name} ${r.last_name} (${r.participants} personne(s)) ?`,
      )
    )
      return;
    await act(async () => {
      await api('admin/reservations', {
        id: r.id,
        version: r.version,
        status: value,
      });
      await refresh();
      setNotice(
        'Demande mise à jour. Consultez le suivi des emails ci-dessous.',
      );
    });
  }
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <a className="brand" href={sitePath('/')}>
          <span className="brand-mark">▦</span>
          <span>
            Micro-Folie<small>Noisy-le-Sec · Équipe</small>
          </span>
        </a>
        <div className="header-actions">
          <a href={sitePath('/')} target="_blank" rel="noreferrer">
            Voir le site <ArrowUpRight size={16} />
          </a>
          <Button variant="outline" onClick={logout} disabled={busy}>
            <LogOut />
            Déconnexion
          </Button>
        </div>
      </header>
      <main className="admin-main">
        <div className="page-heading">
          <div>
            <p className="eyebrow">L’ESPACE DE L’ÉQUIPE</p>
            <h1>Faire vivre la Micro-Folie.</h1>
            <p>
              {user.name} · {user.email}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => act(refresh)}
          >
            <RefreshCw />
            Actualiser
          </Button>
        </div>
        <div className="stats">
          <div>
            <span>À confirmer</span>
            <strong>{pending}</strong>
            <small>Demandes à traiter sous 48 h</small>
          </div>
          <div>
            <span>En liste d’attente</span>
            <strong>{waiting}</strong>
            <small>À rappeler dès qu’une place se libère</small>
          </div>
          <div>
            <span>Ateliers à venir</span>
            <strong>
              {
                data.workshops.filter(
                  (w: any) =>
                    w.status === 'published' &&
                    w.starts_at > new Date().toISOString(),
                ).length
              }
            </strong>
            <small>Visibles dans l’agenda</small>
          </div>
        </div>
        {error && (
          <div role="alert" className="error notice">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="success notice">
            {notice}
          </div>
        )}
        {!data.emailConfigured && (
          <div className="warning notice">
            <strong>Les emails ne sont pas encore activés.</strong> Les demandes
            sont enregistrées. Contactez les participants par téléphone ou email
            jusqu’à la configuration de l’expéditeur dans l’onglet Équipe &
            emails.
          </div>
        )}
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList className="admin-tabs">
            <TabsTrigger value="reservations">
              <Users />
              Réservations
            </TabsTrigger>
            <TabsTrigger value="workshops">
              <CalendarDays />
              Ateliers
            </TabsTrigger>
            <TabsTrigger value="news">
              <Newspaper />
              Actualités
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Mail />
              Équipe & emails
            </TabsTrigger>
          </TabsList>
          <TabsContent value="reservations">
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Les réservations</h2>
                  <p>
                    Les demandes « À confirmer » retiennent les places pendant
                    48 heures maximum.
                  </p>
                </div>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer />
                  Liste de présence
                </Button>
              </div>
              <div className="filters">
                <Input
                  aria-label="Chercher une réservation"
                  placeholder="Nom, email, référence…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <NativeSelect
                  aria-label="Filtrer par atelier"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="">Tous les ateliers</option>
                  {data.workshops.map((w: any) => (
                    <option key={w.id} value={w.id}>
                      {w.title} · {formatDate(w.starts_at)}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect
                  aria-label="Filtrer par statut"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Tous les statuts</option>
                  {[
                    'pending',
                    'confirmed',
                    'waitlist',
                    'refused',
                    'cancelled',
                    'expired',
                  ].map((s) => (
                    <option key={s} value={s}>
                      {labels[s]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="print-list">
                <h2 className="print-only">Micro-Folie · Liste de présence</h2>
                <p className="print-only">
                  {filter
                    ? data.workshops.find((w: any) => w.id === filter)?.title
                    : 'Tous les ateliers'}{' '}
                  · {rows.length} demandes ·{' '}
                  {rows.reduce((n: number, r: any) => n + r.participants, 0)}{' '}
                  personnes
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participant</TableHead>
                      <TableHead>Atelier</TableHead>
                      <TableHead>Places</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="no-print">Actions</TableHead>
                      <TableHead className="print-only">Présence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <strong>
                            {r.first_name} {r.last_name}
                          </strong>
                          <small>{r.reference}</small>
                          <a href={'mailto:' + r.email}>{r.email}</a>
                          {r.phone && <a href={'tel:' + r.phone}>{r.phone}</a>}
                        </TableCell>
                        <TableCell>
                          {r.title}
                          <small>{formatDate(r.starts_at)}</small>
                        </TableCell>
                        <TableCell>{r.participants}</TableCell>
                        <TableCell>
                          <Badge status={r.status} />
                          {r.status === 'pending' && (
                            <small>Jusqu’au {formatDate(r.hold_until)}</small>
                          )}
                        </TableCell>
                        <TableCell className="no-print actions">
                          {['pending', 'waitlist'].includes(r.status) && (
                            <>
                              <Button
                                disabled={busy}
                                onClick={() => decide(r, 'confirmed')}
                              >
                                Confirmer
                              </Button>
                              <Button
                                disabled={busy}
                                variant="outline"
                                onClick={() => decide(r, 'refused')}
                              >
                                Refuser
                              </Button>
                            </>
                          )}
                          {r.status === 'confirmed' && (
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() => decide(r, 'cancelled')}
                            >
                              Annuler
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="print-only">□</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!rows.length && (
                  <p className="empty">
                    Aucune réservation pour cette sélection.
                  </p>
                )}
              </div>
              <p className="muted">
                Les 1 000 dernières demandes sont affichées. La liste d’attente
                est traitée par l’équipe, sans confirmation automatique.
              </p>
            </section>
          </TabsContent>
          <TabsContent value="workshops">
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Les ateliers</h2>
                  <p>
                    Une seule publication alimente l’agenda et les réservations.
                  </p>
                </div>
                <Button
                  disabled={busy}
                  onClick={() =>
                    setWorkshop({
                      status: 'draft',
                      category: 'Famille',
                      capacity: 12,
                      min_age: 0,
                    })
                  }
                >
                  <Plus />
                  Créer un atelier
                </Button>
              </div>
              {workshop && (
                <form
                  className="editor form-grid"
                  key={workshop.id ?? 'new'}
                  onSubmit={saveWorkshop}
                >
                  <h3 className="wide">
                    {workshop.id ? 'Modifier l’atelier' : 'Nouvel atelier'}
                  </h3>
                  <Field label="Titre" wide>
                    <Input
                      name="title"
                      defaultValue={workshop.title}
                      maxLength={180}
                      required
                    />
                  </Field>
                  <Field label="Description" wide>
                    <Textarea
                      name="description"
                      defaultValue={workshop.description}
                      required
                      maxLength={5000}
                    />
                  </Field>
                  <Field label="Catégorie">
                    <NativeSelect
                      name="category"
                      defaultValue={workshop.category}
                    >
                      {[
                        'Famille',
                        'FabLab',
                        'Cuisine',
                        'Jardin',
                        'Musée numérique',
                        'Événement',
                      ].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Statut">
                    <NativeSelect name="status" defaultValue={workshop.status}>
                      {['draft', 'published', 'archived'].map((s) => (
                        <option key={s} value={s}>
                          {labels[s]}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Début · heure de Paris">
                    <Input
                      name="starts_at"
                      type="datetime-local"
                      defaultValue={parisInput(workshop.starts_at)}
                      required
                    />
                  </Field>
                  <Field label="Fin · heure de Paris">
                    <Input
                      name="ends_at"
                      type="datetime-local"
                      defaultValue={parisInput(workshop.ends_at)}
                      required
                    />
                  </Field>
                  <Field label="Nombre de places">
                    <Input
                      name="capacity"
                      type="number"
                      min={1}
                      max={500}
                      defaultValue={workshop.capacity}
                      required
                    />
                  </Field>
                  <Field label="Âge minimum">
                    <Input
                      name="min_age"
                      type="number"
                      min={0}
                      max={110}
                      defaultValue={workshop.min_age}
                      required
                    />
                  </Field>
                  <div className="actions wide">
                    <Button type="submit" disabled={busy}>
                      Enregistrer l’atelier
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => setWorkshop(null)}
                    >
                      Fermer
                    </Button>
                  </div>
                </form>
              )}
              <div className="item-list">
                {data.workshops.map((w: any) => (
                  <article className="item" key={w.id}>
                    <div>
                      <Badge status={w.status} />
                      <h3>{w.title}</h3>
                      <p>
                        {formatDate(w.starts_at)} · {w.category}
                      </p>
                      <small>
                        {w.occupied} / {w.capacity} places retenues · dès{' '}
                        {w.min_age} ans
                      </small>
                    </div>
                    <Button variant="outline" onClick={() => setWorkshop(w)}>
                      Modifier
                    </Button>
                  </article>
                ))}
                {!data.workshops.length && (
                  <p className="empty">
                    Créez le premier atelier pour ouvrir les réservations. Les
                    anciennes dates ne sont pas reconduites automatiquement.
                  </p>
                )}
              </div>
            </section>
          </TabsContent>
          <TabsContent value="news">
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Les actualités</h2>
                  <p>Rédigez un brouillon, ajoutez une photo, puis publiez.</p>
                </div>
                <Button
                  onClick={() =>
                    setNews({
                      status: 'draft',
                      published_at: new Date().toISOString(),
                    })
                  }
                >
                  <Plus />
                  Nouvelle actualité
                </Button>
              </div>
              {news && (
                <form
                  className="editor form-grid"
                  key={news.id ?? 'new'}
                  onSubmit={saveNews}
                >
                  <h3 className="wide">
                    {news.id ? 'Modifier l’actualité' : 'Nouvelle actualité'}
                  </h3>
                  <Field label="Titre" wide>
                    <Input
                      name="title"
                      defaultValue={news.title}
                      required
                      maxLength={180}
                    />
                  </Field>
                  <Field label="Texte" wide>
                    <Textarea
                      name="body"
                      defaultValue={news.body}
                      required
                      maxLength={12000}
                      rows={8}
                    />
                  </Field>
                  <Field label="Photo · JPEG, PNG, WebP, 3 Mo maximum" wide>
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file)
                          act(async () => {
                            if (file.size > 3 * 1024 * 1024)
                              throw new Error('Photo limitée à 3 Mo.');
                            const r = await apiFetch('upload', {
                              method: 'POST',
                              headers: { 'Content-Type': file.type },
                              body: file,
                            });
                            const result: any = await r.json();
                            if (!r.ok) throw new Error(result.error);
                            setNews((n: any) => ({
                              ...n,
                              image_key: result.key,
                            }));
                          });
                      }}
                    />
                  </Field>
                  {news.image_key && (
                    <div className="wide photo-preview">
                      <PrivateImage imageKey={news.image_key} />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setNews({ ...news, image_key: '' })}
                      >
                        Retirer la photo
                      </Button>
                    </div>
                  )}
                  <Field label="Lien facultatif" wide>
                    <Input
                      name="link"
                      type="url"
                      placeholder="https://…"
                      defaultValue={news.link}
                    />
                  </Field>
                  <Field label="Publication · heure de Paris">
                    <Input
                      name="published_at"
                      type="datetime-local"
                      defaultValue={parisInput(news.published_at)}
                      required
                    />
                  </Field>
                  <Field label="Statut">
                    <NativeSelect name="status" defaultValue={news.status}>
                      {['draft', 'published', 'archived'].map((s) => (
                        <option key={s} value={s}>
                          {labels[s]}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <p className="wide muted">
                    Une actualité publiée avec une date future apparaîtra à
                    cette date.
                  </p>
                  <div className="actions wide">
                    <Button type="submit" disabled={busy}>
                      Enregistrer l’actualité
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setNews(null)}
                    >
                      Fermer
                    </Button>
                  </div>
                </form>
              )}
              <div className="item-list">
                {data.news.map((n: any) => (
                  <article className="item" key={n.id}>
                    <div>
                      <Badge status={n.status} />
                      <h3>{n.title}</h3>
                      <p>{formatDate(n.published_at)}</p>
                    </div>
                    <Button variant="outline" onClick={() => setNews(n)}>
                      Modifier
                    </Button>
                  </article>
                ))}
                {!data.news.length && (
                  <p className="empty">
                    Aucune actualité. Préparez la première nouvelle du lieu.
                  </p>
                )}
              </div>
            </section>
          </TabsContent>
          <TabsContent value="settings">
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Suivi des emails</h2>
                  <p>
                    {data.emailConfigured
                      ? 'Un expéditeur est configuré. Les éventuels échecs apparaissent ici.'
                      : 'Les emails restent en attente jusqu’à l’activation de l’expéditeur.'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={busy || !data.emailConfigured}
                  onClick={() =>
                    act(async () => {
                      const r = await api('admin/mail/retry', {});
                      await refresh();
                      setNotice(
                        `${r.sent} email(s) accepté(s) par le service d’envoi.`,
                      );
                    })
                  }
                >
                  Relancer les envois
                </Button>
              </div>
              {data.mail.map((m: any) => (
                <div className="mail-item" key={m.id}>
                  <strong>{m.subject}</strong>
                  <p>
                    {m.status === 'sending' ? 'En cours' : 'En attente'} ·{' '}
                    {m.attempts} tentative(s)
                  </p>
                  {m.last_error && <small>{m.last_error}</small>}
                </div>
              ))}
              {!data.mail.length && (
                <p className="empty">Aucun email en attente.</p>
              )}
            </section>
            {data.isOwner && (
              <>
                <section className="panel">
                  <h2>Expéditeur des emails</h2>
                  <p>
                    Renseignez une adresse d’envoi sur un domaine vérifié dans
                    Resend. La clé est protégée et ne sera jamais affichée.
                  </p>
                  <form
                    className="form-grid"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      act(async () => {
                        await api('admin/mail/config', Object.fromEntries(f));
                        await refresh();
                        setNotice(
                          'Expéditeur enregistré. Vous pouvez relancer les emails en attente.',
                        );
                      });
                    }}
                  >
                    <Field label="Adresse d’envoi">
                      <Input
                        type="email"
                        name="from"
                        required
                        defaultValue={data.emailFrom}
                        placeholder="reservations@votre-domaine.fr"
                      />
                    </Field>
                    <Field label="Clé API Resend">
                      <Input
                        type="password"
                        name="key"
                        autoComplete="off"
                        placeholder={
                          data.emailConfigured
                            ? 'Laisser vide pour conserver la clé'
                            : 're_…'
                        }
                      />
                    </Field>
                    <Button type="submit" disabled={busy}>
                      Enregistrer l’expéditeur
                    </Button>
                  </form>
                </section>
                <section className="panel">
                  <h2>Accès de l’équipe</h2>
                  <p>
                    Responsable : {data.ownerEmail}. Chaque membre choisit son
                    propre mot de passe.
                  </p>
                  <form
                    className="filters"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      act(async () => {
                        const r = await api('admin/invite', {
                          email: f.get('email'),
                        });
                        setInvite(r.url);
                        await refresh();
                      });
                    }}
                  >
                    <Input
                      name="email"
                      type="email"
                      required
                      aria-label="Email du membre à ajouter"
                      placeholder="Email du membre de l’équipe"
                    />
                    <Button type="submit" disabled={busy}>
                      Créer un lien d’activation
                    </Button>
                  </form>
                  {invite && (
                    <div className="notice success">
                      <p>
                        Transmettez ce lien personnel au membre concerné. Il est
                        utilisable une fois pendant 7 jours.
                      </p>
                      <Input
                        readOnly
                        value={invite}
                        aria-label="Lien d’activation"
                      />
                      <Button
                        variant="outline"
                        onClick={() =>
                          act(async () => {
                            await navigator.clipboard.writeText(invite);
                            setNotice('Lien copié.');
                          })
                        }
                      >
                        Copier le lien
                      </Button>
                    </div>
                  )}
                  {data.admins.map((a: any) => (
                    <div className="item" key={a.email}>
                      <span>{a.email}</span>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              'Retirer l’accès de ' + a.email + ' ?',
                            )
                          )
                            act(async () => {
                              await api('admin/revoke', { email: a.email });
                              await refresh();
                            });
                        }}
                      >
                        Retirer l’accès
                      </Button>
                    </div>
                  ))}
                </section>
              </>
            )}
          </TabsContent>
        </Tabs>
        <footer className="admin-footer">
          Micro-Folie Noisy-le-Sec · Accès réservé à l’équipe
        </footer>
      </main>
    </div>
  );
}
