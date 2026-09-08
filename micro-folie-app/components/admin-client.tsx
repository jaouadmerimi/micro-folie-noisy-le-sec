'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Newspaper,
  Settings2,
  ArrowRight,
  ArrowUpRight,
  Plus,
  Search,
  ChevronRight,
  LogOut,
  RefreshCw,
  Check,
  Clock3,
  Mail,
  Printer,
  Eye,
  EyeOff,
  X,
  Menu,
  Flower2,
  FilePenLine,
} from 'lucide-react';
import { api } from '../lib/http';
import { sitePath } from '../lib/urls';
import { PrivateImage } from './private-image';
import {
  Mark,
  SiteLink,
  Badge,
  Busy,
  Empty,
  ArrowButton,
  shortDate,
  time,
  labels,
  type AdminData,
  type Reservation,
  type Workshop,
  type News,
} from './admin/shared';
import { ContentEditor } from './admin/editors';
import { Settings } from './admin/settings';
import { ReservationDetail } from './admin/reservation-detail';
import './admin/studio.css';

const navigation = [
  { id: 'overview', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { id: 'reservations', label: 'Réservations', icon: Users },
  { id: 'workshops', label: 'Ateliers', icon: CalendarDays },
  { id: 'news', label: 'Actualités', icon: Newspaper },
  { id: 'settings', label: 'Équipe & emails', icon: Settings2 },
];
type Editor =
  | { kind: 'workshop'; item?: Workshop }
  | { kind: 'news'; item?: News };
const getPage = () => {
  const hash = window.location.hash.slice(1);
  return navigation.some((n) => n.id === hash) ? hash : 'overview';
};
export default function AdminClient() {
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [data, setData] = useState<AdminData | null>(null),
    [user, setUser] = useState<{ name: string; email: string } | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(getPage),
    [mobile, setMobile] = useState(false),
    [showPassword, setShowPassword] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null),
    [selected, setSelected] = useState<Reservation | null>(null),
    [status, setStatus] = useState(''),
    [search, setSearch] = useState(''),
    [workshopFilter, setWorkshopFilter] = useState(''),
    [contentFilter, setContentFilter] = useState(''),
    [contentSearch, setContentSearch] = useState('');
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const session = await api('auth/get-session');
        if (!active) return;
        if (session?.user) {
          setUser(session.user);
          const result = await api('admin');
          if (active) setData(result);
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    const onHash = () => {
      setPage(getPage());
      setMobile(false);
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      active = false;
      window.removeEventListener('hashchange', onHash);
    };
  }, []);
  useEffect(() => {
    document.title =
      (navigation.find((n) => n.id === page)?.label ?? 'Administration') +
      ' · Micro-Folie';
  }, [page]);
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(''), 6000);
    return () => window.clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    if (!mobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebarRef.current?.querySelector('button')?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobile(false);
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', escape);
      menuRef.current?.focus();
    };
  }, [mobile]);
  function go(next: string) {
    setPage(next);
    window.history.replaceState(null, '', '#' + next);
    setMobile(false);
    setContentSearch('');
    setContentFilter('');
  }
  async function refresh(message = '') {
    try {
      const result = await api('admin');
      setData(result);
      setError('');
    } catch (e) {
      if (!message) throw e;
      setError(
        'L’action est enregistrée, mais la liste n’a pas pu être rechargée. Cliquez sur Actualiser les données.',
      );
    }
    if (message) setNotice(message);
  }
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
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
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    await run(async () => {
      await api('auth/sign-in/email', { ...fields, rememberMe: false });
      const session = await api('auth/get-session');
      setUser(session.user);
      await refresh();
    });
  }
  const logout = () =>
    void run(async () => {
      await api('auth/sign-out', {});
      setMobile(false);
      setUser(null);
      setData(null);
    });
  if (loading)
    return (
      <main className="studio mf-loading">
        <Mark />
        <p>
          <Busy>Ouverture de votre espace…</Busy>
        </p>
      </main>
    );
  if (!data)
    return (
      <main className="studio mf-login">
        <section className="mf-login-art">
          <a href={sitePath('/')} className="mf-brand">
            <Mark />
            <span>
              Micro-Folie<small>Noisy-le-Sec</small>
            </span>
          </a>
          <div>
            <p className="mf-eyebrow">L’ESPACE DE L’ÉQUIPE</p>
            <h1>
              Un lieu vivant.
              <br />
              Une équipe
              <br />
              <em>qui le fait vivre.</em>
            </h1>
            <p>
              Les ateliers, les rencontres et les nouvelles du lieu. Tout
              commence ici.
            </p>
          </div>
          <div className="mf-art" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
          <small>53 rue de Merlan · Noisy-le-Sec</small>
        </section>
        <section className="mf-login-form">
          <SiteLink />
          <div>
            <p className="mf-eyebrow">BIENVENUE</p>
            <h2>Ravi de vous retrouver.</h2>
            <p>Connectez-vous pour préparer les prochains rendez-vous.</p>
            {error && (
              <p className="mf-form-error" role="alert">
                {error.includes('Invalid email or password')
                  ? 'Email ou mot de passe incorrect. Réessayez.'
                  : error}
              </p>
            )}
            {user ? (
              <>
                <p>
                  Votre session est ouverte, mais le tableau de bord n’a pas pu
                  être chargé.
                </p>
                <button
                  className="mf-button"
                  disabled={busy}
                  onClick={() => void run(() => refresh())}
                >
                  Réessayer
                </button>
                <button className="mf-button secondary" onClick={logout}>
                  Se déconnecter
                </button>
              </>
            ) : (
              <form onSubmit={login}>
                <label className="mf-field">
                  <span>Adresse email</span>
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="vous@exemple.fr"
                  />
                </label>
                <label className="mf-field">
                  <span>Mot de passe</span>
                  <div className="mf-password">
                    <input
                      name="password"
                      aria-label="Mot de passe"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="Votre mot de passe"
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword
                          ? 'Masquer le mot de passe'
                          : 'Afficher le mot de passe'
                      }
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
                <a
                  className="mf-forgot"
                  href={sitePath('/admin/mot-de-passe/')}
                >
                  Mot de passe oublié ?
                </a>
                <button className="mf-button mf-login-submit" disabled={busy}>
                  {busy ? (
                    <Busy>Connexion…</Busy>
                  ) : (
                    <>
                      Entrer dans mon espace
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
            )}
            <p className="mf-login-foot">
              Cet espace est réservé à l’équipe de la Micro-Folie.
            </p>
          </div>
          <small>Micro-Folie · La culture, en bas de chez vous.</small>
        </section>
      </main>
    );
  const pending = data.reservations.filter((r) => r.status === 'pending'),
    waiting = data.reservations.filter((r) => r.status === 'waitlist'),
    upcoming = data.workshops
      .filter(
        (w) =>
          w.status === 'published' && w.starts_at > new Date().toISOString(),
      )
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const rows = data.reservations
    .filter(
      (r) =>
        (!status ||
          (status === 'closed'
            ? ['cancelled', 'refused', 'expired'].includes(r.status)
            : r.status === status)) &&
        (!workshopFilter || r.workshop_id === workshopFilter) &&
        `${r.first_name} ${r.last_name} ${r.email} ${r.reference}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort((a, b) => {
      const p = (r: Reservation) =>
        r.status === 'pending' ? 0 : r.status === 'waitlist' ? 1 : 2;
      return (
        p(a) - p(b) ||
        (a.status === 'pending'
          ? a.hold_until.localeCompare(b.hold_until)
          : b.created_at.localeCompare(a.created_at))
      );
    });
  const firstName = user?.name?.split(' ')[0] || 'à vous';
  const pageInfo: Record<string, { title: string; description: string }> = {
    overview: {
      title: data.isOwner ? 'Bienvenue.' : `Bonjour ${firstName}.`,
      description: 'Un coup d’œil sur la vie de votre Micro-Folie.',
    },
    reservations: {
      title: 'Les réservations',
      description: 'Chaque demande, la bonne attention.',
    },
    workshops: {
      title: 'Le programme',
      description:
        'Préparez les prochaines découvertes, ouvrez les réservations.',
    },
    news: {
      title: 'Les actualités',
      description: 'Racontez ce qui se passe à la Micro-Folie.',
    },
    settings: {
      title: 'L’équipe & les emails',
      description: 'Les bons accès et les bons messages, au même endroit.',
    },
  };
  const filteredWorkshops = data.workshops
    .filter(
      (w) =>
        (!contentFilter || w.status === contentFilter) &&
        w.title.toLowerCase().includes(contentSearch.toLowerCase()),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const filteredNews = data.news.filter(
    (n) =>
      (!contentFilter || n.status === contentFilter) &&
      n.title.toLowerCase().includes(contentSearch.toLowerCase()),
  );
  const completed =
    Number(data.workshops.length > 0) +
    Number(data.news.length > 0) +
    Number(data.emailConfigured);
  function filterReservations(value: string) {
    setStatus(value);
    go('reservations');
  }
  const dateTile = (w: Workshop) => (
    <div className="mf-date-tile">
      <strong>{shortDate(w.starts_at, { day: '2-digit' })}</strong>
      <span>{shortDate(w.starts_at, { month: 'short' })}</span>
    </div>
  );
  function workshopRow(w: Workshop) {
    return (
      <button
        className="mf-event-row"
        key={w.id}
        onClick={() => setEditor({ kind: 'workshop', item: w })}
      >
        {dateTile(w)}
        <div>
          <strong>{w.title}</strong>
          <small>
            {time(w.starts_at)} – {time(w.ends_at)} · {w.category}
          </small>
        </div>
        <span className="mf-seat-summary">
          {w.occupied}/{w.capacity}
          <small>places retenues</small>
        </span>
        <ChevronRight size={17} />
      </button>
    );
  }
  return (
    <div className={'studio mf-studio' + (mobile ? ' nav-open' : '')}>
      <a className="mf-skip" href="#studio-content">
        Aller au contenu
      </a>
      {mobile && (
        <button
          className="mf-nav-scrim"
          aria-label="Fermer la navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside ref={sidebarRef} className="mf-sidebar">
        <a className="mf-brand" href={sitePath('/')}>
          <Mark />
          <span>
            Micro-Folie<small>Noisy-le-Sec</small>
          </span>
        </a>
        <div className="mf-workspace-label">
          <span />
          ESPACE ÉQUIPE
        </div>
        <nav aria-label="Administration">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? 'active' : ''}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => go(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === 'reservations' && pending.length > 0 && (
                <b>{pending.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="mf-sidebar-note">
          <Flower2 size={25} />
          <p>
            La culture se partage.
            <br />
            <strong>Vous la faites vivre.</strong>
          </p>
        </div>
        <div className="mf-sidebar-user">
          <span className="mf-avatar">
            {user?.name
              ?.split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')}
          </span>
          <div>
            <strong>{user?.name}</strong>
            <small>{data.isOwner ? 'Responsable' : 'Équipe Micro-Folie'}</small>
          </div>
          <button
            className="mf-icon-button"
            title="Déconnexion"
            aria-label="Déconnexion"
            disabled={busy}
            onClick={logout}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="mf-workspace" inert={mobile}>
        <header className="mf-topbar">
          <button
            ref={menuRef}
            className="mf-mobile-menu mf-icon-button"
            aria-label="Ouvrir la navigation"
            aria-expanded={mobile}
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={21} />
          </button>
          <div className="mf-breadcrumb">
            Espace équipe
            <ChevronRight size={13} />
            <strong>{navigation.find((n) => n.id === page)?.label}</strong>
          </div>
          <div>
            <span className="mf-today">
              {shortDate(new Date().toISOString(), {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </span>
            <SiteLink />
          </div>
        </header>
        <main id="studio-content" className="mf-main">
          <div className="mf-page-heading">
            <div>
              <p className="mf-eyebrow">
                {page === 'overview'
                  ? 'VOTRE MICRO-FOLIE, AU QUOTIDIEN'
                  : 'GESTION DU LIEU'}
              </p>
              <h1>{pageInfo[page].title}</h1>
              <p>{pageInfo[page].description}</p>
            </div>
            <div className="mf-heading-actions">
              <button
                className="mf-icon-button"
                title="Actualiser les données"
                aria-label="Actualiser les données"
                disabled={busy}
                onClick={() => void run(() => refresh('Données actualisées.'))}
              >
                <RefreshCw size={18} className={busy ? 'mf-spin' : ''} />
              </button>
              {page === 'news' ? (
                <button
                  className="mf-button"
                  onClick={() => setEditor({ kind: 'news' })}
                >
                  <Plus size={17} />
                  Nouvelle actualité
                </button>
              ) : (
                page !== 'settings' && (
                  <button
                    className="mf-button"
                    onClick={() => setEditor({ kind: 'workshop' })}
                  >
                    <Plus size={17} />
                    Créer un atelier
                  </button>
                )
              )}
            </div>
          </div>
          {error && (
            <div className="mf-form-error" role="alert">
              {error}
              <button
                className="mf-icon-button"
                aria-label="Fermer le message"
                onClick={() => setError('')}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {page === 'overview' && (
            <>
              <section className="mf-metrics" aria-label="En un coup d’œil">
                {[
                  {
                    label: 'À confirmer',
                    value: pending.length,
                    note: pending.length
                      ? 'Demandes à traiter en priorité'
                      : 'Tout est à jour',
                    icon: Clock3,
                    key: 'pending',
                    color: 'orange',
                  },
                  {
                    label: 'En liste d’attente',
                    value: waiting.length,
                    note: 'Pour les prochaines places libres',
                    icon: Users,
                    key: 'waitlist',
                    color: 'blue',
                  },
                  {
                    label: 'Ateliers à venir',
                    value: upcoming.length,
                    note: 'Ouverts aux réservations',
                    icon: CalendarDays,
                    key: 'workshops',
                    color: 'green',
                  },
                  {
                    label: 'Actualités publiées',
                    value: data.news.filter(
                      (n) =>
                        n.status === 'published' &&
                        n.published_at <= new Date().toISOString(),
                    ).length,
                    note: 'Les nouvelles visibles sur le site',
                    icon: Newspaper,
                    key: 'news',
                    color: 'purple',
                  },
                ].map(({ label, value, note, icon: Icon, key, color }) => (
                  <button
                    className="mf-metric"
                    key={key}
                    onClick={() =>
                      key === 'pending' || key === 'waitlist'
                        ? filterReservations(key)
                        : go(key)
                    }
                  >
                    <span className="mf-metric-label">
                      {label}
                      <span className={'mf-metric-icon ' + color}>
                        <Icon size={17} />
                      </span>
                    </span>
                    <strong>{value.toString().padStart(2, '0')}</strong>
                    <small>
                      {note}
                      <ArrowUpRight size={14} />
                    </small>
                  </button>
                ))}
              </section>
              {data.workshops.length === 0 && (
                <section className="mf-welcome">
                  <div>
                    <span className="mf-eyebrow">
                      UNE NOUVELLE SAISON À ÉCRIRE
                    </span>
                    <h2>
                      Tout commence
                      <br />
                      par un rendez-vous.
                    </h2>
                    <p>
                      Ajoutez votre premier atelier. Il apparaîtra dans l’agenda
                      dès sa publication, prêt à accueillir ses premiers
                      participants.
                    </p>
                    <button
                      className="mf-button"
                      onClick={() => setEditor({ kind: 'workshop' })}
                    >
                      Créer le premier atelier
                      <ArrowRight size={17} />
                    </button>
                  </div>
                  <div className="mf-welcome-art" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <span>
                      PLACE AUX
                      <br />
                      RENCONTRES.
                    </span>
                  </div>
                </section>
              )}
              <div className="mf-overview-grid">
                <section className="mf-card">
                  <header className="mf-card-header">
                    <div>
                      <span className="mf-eyebrow">LE PROGRAMME</span>
                      <h2>Les prochains rendez-vous</h2>
                    </div>
                    <ArrowButton onClick={() => go('workshops')}>
                      Tout voir
                    </ArrowButton>
                  </header>
                  {upcoming.length ? (
                    <div>{upcoming.slice(0, 4).map(workshopRow)}</div>
                  ) : (
                    <Empty
                      icon={<CalendarDays size={27} />}
                      title="Le programme est à écrire"
                      text="Les ateliers publiés et à venir apparaîtront ici."
                      action={
                        <ArrowButton
                          onClick={() => setEditor({ kind: 'workshop' })}
                        >
                          Préparer un atelier
                        </ArrowButton>
                      }
                    />
                  )}
                </section>
                <section className="mf-card mf-priorities">
                  <header className="mf-card-header">
                    <div>
                      <span className="mf-eyebrow">VOTRE PROCHAINE ACTION</span>
                      <h2>
                        {completed < 3 ? 'Bien démarrer' : 'À votre attention'}
                      </h2>
                    </div>
                    {completed < 3 && (
                      <span className="mf-count">{completed}/3</span>
                    )}
                  </header>
                  {completed < 3 ? (
                    <div className="mf-start-steps">
                      {[
                        {
                          label: 'Préparer le premier atelier',
                          hint: 'Une date, une activité, des places.',
                          done: data.workshops.length > 0,
                          click: () => setEditor({ kind: 'workshop' }),
                        },
                        {
                          label: 'Partager une première actualité',
                          hint: 'Donner des nouvelles du lieu.',
                          done: data.news.length > 0,
                          click: () => setEditor({ kind: 'news' }),
                        },
                        {
                          label: 'Activer les emails',
                          hint: 'Prévenir les participants automatiquement.',
                          done: data.emailConfigured,
                          click: () => go('settings'),
                        },
                      ].map((s, i) => (
                        <button key={s.label} onClick={s.click}>
                          <span className={s.done ? 'done' : ''}>
                            {s.done ? (
                              <Check size={15} />
                            ) : (
                              String(i + 1).padStart(2, '0')
                            )}
                          </span>
                          <div>
                            <strong>{s.label}</strong>
                            <small>{s.hint}</small>
                          </div>
                          <ChevronRight size={16} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mf-start-steps">
                      <button onClick={() => filterReservations('pending')}>
                        <span>
                          <Clock3 size={18} />
                        </span>
                        <div>
                          <strong>
                            {pending.length
                              ? `${pending.length} demande(s) à confirmer`
                              : 'Aucune demande à traiter'}
                          </strong>
                          <small>Retrouvez toutes les réservations.</small>
                        </div>
                        <ChevronRight size={16} />
                      </button>
                      <button onClick={() => go('settings')}>
                        <span>
                          <Mail size={18} />
                        </span>
                        <div>
                          <strong>
                            {data.mail.length} email(s) en attente
                          </strong>
                          <small>Vérifier les envois aux participants.</small>
                        </div>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
          {page === 'reservations' && (
            <section className="mf-card mf-reservations">
              <div
                className="mf-status-tabs"
                role="group"
                aria-label="Statut des réservations"
              >
                {[
                  ['', 'Toutes'],
                  ['pending', 'À confirmer'],
                  ['confirmed', 'Confirmées'],
                  ['waitlist', 'Liste d’attente'],
                  ['closed', 'Terminées'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={status === value ? 'active' : ''}
                    aria-pressed={status === value}
                    onClick={() => setStatus(value)}
                  >
                    {label}
                    <span>
                      {value === 'closed'
                        ? data.reservations.filter((r) =>
                            ['cancelled', 'refused', 'expired'].includes(
                              r.status,
                            ),
                          ).length
                        : data.reservations.filter(
                            (r) => !value || r.status === value,
                          ).length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mf-toolbar">
                <label className="mf-search">
                  <Search size={17} />
                  <input
                    aria-label="Chercher une réservation"
                    placeholder="Nom, email ou référence…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filtrer par atelier"
                  value={workshopFilter}
                  onChange={(e) => setWorkshopFilter(e.target.value)}
                >
                  <option value="">Tous les ateliers</option>
                  {data.workshops.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title} · {shortDate(w.starts_at)}
                    </option>
                  ))}
                </select>
                <button
                  className="mf-button secondary"
                  disabled={
                    !data.reservations.some(
                      (r) =>
                        r.status === 'confirmed' &&
                        (!workshopFilter || r.workshop_id === workshopFilter),
                    )
                  }
                  onClick={() => window.print()}
                >
                  <Printer size={16} />
                  Liste de présence
                </button>
              </div>
              {!data.emailConfigured && (
                <div className="mf-mail-strip">
                  <Mail size={16} />
                  <span>
                    Les emails sont désactivés. Prévenez directement les
                    participants.
                  </span>
                  <button onClick={() => go('settings')}>
                    Configurer
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
              {rows.length ? (
                <>
                  <div className="mf-table-scroll">
                    <table className="mf-reservation-table">
                      <thead>
                        <tr>
                          <th>Participant</th>
                          <th>Atelier</th>
                          <th>Places</th>
                          <th>Statut</th>
                          <th>
                            <span className="mf-sr-only">Consulter</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <button
                                className="mf-participant"
                                onClick={() => setSelected(r)}
                              >
                                <span className="mf-avatar pale">
                                  {r.first_name[0]}
                                  {r.last_name[0]}
                                </span>
                                <span>
                                  <strong>
                                    {r.first_name} {r.last_name}
                                  </strong>
                                  <small>{r.email}</small>
                                </span>
                              </button>
                            </td>
                            <td>
                              <strong>{r.title}</strong>
                              <small>
                                {shortDate(r.starts_at)} · {time(r.starts_at)}
                              </small>
                            </td>
                            <td>
                              <span className="mf-person-count">
                                <Users size={14} />
                                {r.participants}
                              </span>
                            </td>
                            <td>
                              <Badge status={r.status} />
                              {r.status === 'pending' && (
                                <small>
                                  Avant le {shortDate(r.hold_until)} ·{' '}
                                  {time(r.hold_until)}
                                </small>
                              )}
                            </td>
                            <td>
                              <button
                                className="mf-icon-button"
                                aria-label={
                                  'Consulter la demande de ' +
                                  r.first_name +
                                  ' ' +
                                  r.last_name
                                }
                                onClick={() => setSelected(r)}
                              >
                                <ChevronRight size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mf-table-footer">
                    {rows.length} demande(s) ·{' '}
                    {rows.reduce((sum, r) => sum + r.participants, 0)}{' '}
                    personne(s)
                    <span>
                      Les demandes à confirmer apparaissent en premier.
                    </span>
                  </div>
                </>
              ) : (
                <Empty
                  title={
                    data.reservations.length
                      ? 'Aucune demande ne correspond'
                      : 'Les prochaines rencontres commencent ici'
                  }
                  text={
                    data.reservations.length
                      ? 'Essayez un autre filtre ou recherchez un autre participant.'
                      : 'Dès qu’un visiteur réserve un atelier, sa demande apparaît ici. Vous pourrez la consulter et la confirmer.'
                  }
                  action={
                    data.reservations.length ? (
                      <ArrowButton
                        onClick={() => {
                          setSearch('');
                          setStatus('');
                          setWorkshopFilter('');
                        }}
                      >
                        Réinitialiser les filtres
                      </ArrowButton>
                    ) : (
                      <ArrowButton onClick={() => go('workshops')}>
                        Voir les ateliers
                      </ArrowButton>
                    )
                  }
                />
              )}
            </section>
          )}
          {(page === 'workshops' || page === 'news') && (
            <>
              <div className="mf-content-toolbar">
                <div
                  className="mf-filter-pills"
                  role="group"
                  aria-label="Visibilité des contenus"
                >
                  {[
                    ['', 'Tous'],
                    ['published', 'Publiés'],
                    ['draft', 'Brouillons'],
                    ['archived', 'Archivés'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      aria-pressed={contentFilter === value}
                      className={contentFilter === value ? 'active' : ''}
                      onClick={() => setContentFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="mf-search">
                  <Search size={17} />
                  <input
                    aria-label={
                      page === 'news'
                        ? 'Rechercher une actualité'
                        : 'Rechercher un atelier'
                    }
                    placeholder="Rechercher…"
                    value={contentSearch}
                    onChange={(e) => setContentSearch(e.target.value)}
                  />
                </label>
              </div>
              {page === 'workshops' ? (
                filteredWorkshops.length ? (
                  <div className="mf-workshop-grid">
                    {filteredWorkshops.map((w) => (
                      <article className="mf-workshop-card" key={w.id}>
                        <header>
                          {dateTile(w)}
                          <Badge status={w.status} />
                        </header>
                        <span className="mf-category">{w.category}</span>
                        <h2>{w.title}</h2>
                        <p>
                          {shortDate(w.starts_at, {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                          })}
                          <br />
                          {time(w.starts_at)} – {time(w.ends_at)}
                        </p>
                        <div className="mf-capacity">
                          <div>
                            <span>
                              <strong>{w.occupied}</strong> / {w.capacity}{' '}
                              places retenues
                            </span>
                            <small>
                              {w.min_age > 0
                                ? `Dès ${w.min_age} ans`
                                : 'Tous les âges'}
                            </small>
                          </div>
                          <progress
                            value={w.occupied}
                            max={w.capacity}
                            aria-label={'Places retenues pour ' + w.title}
                          />
                        </div>
                        <footer>
                          <button
                            className="mf-text-button"
                            onClick={() => {
                              setWorkshopFilter(w.id);
                              setStatus('');
                              go('reservations');
                            }}
                          >
                            Réservations
                            <ArrowUpRight size={15} />
                          </button>
                          <button
                            className="mf-button secondary"
                            onClick={() =>
                              setEditor({ kind: 'workshop', item: w })
                            }
                          >
                            Modifier
                            <FilePenLine size={15} />
                          </button>
                        </footer>
                      </article>
                    ))}
                  </div>
                ) : (
                  <section className="mf-card">
                    <Empty
                      icon={<CalendarDays size={30} />}
                      title={
                        data.workshops.length
                          ? 'Aucun atelier pour ce filtre'
                          : 'Quel sera le prochain rendez-vous ?'
                      }
                      text={
                        data.workshops.length
                          ? 'Modifiez votre recherche ou la visibilité sélectionnée.'
                          : 'Une visite du musée, une création au FabLab, un atelier en famille… Préparez votre première date en quelques minutes.'
                      }
                      action={
                        <button
                          className="mf-button"
                          onClick={() => setEditor({ kind: 'workshop' })}
                        >
                          <Plus size={17} />
                          Créer un atelier
                        </button>
                      }
                    />
                  </section>
                )
              ) : filteredNews.length ? (
                <div className="mf-news-grid">
                  {filteredNews.map((n) => (
                    <article className="mf-news-card" key={n.id}>
                      <div className="mf-news-image">
                        {n.image_key ? (
                          <PrivateImage imageKey={n.image_key} />
                        ) : (
                          <div>
                            <Newspaper size={35} />
                            <span>LES NOUVELLES DU LIEU</span>
                          </div>
                        )}
                        <Badge status={n.status} />
                      </div>
                      <div className="mf-news-body">
                        <small>
                          {shortDate(n.published_at, {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                          {n.status === 'published' &&
                          n.published_at > new Date().toISOString()
                            ? ' · Programmée'
                            : ''}
                        </small>
                        <h2>{n.title}</h2>
                        <p>{n.body}</p>
                        <button
                          className="mf-text-button"
                          onClick={() => setEditor({ kind: 'news', item: n })}
                        >
                          Ouvrir l’actualité
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <section className="mf-card">
                  <Empty
                    icon={<Newspaper size={30} />}
                    title={
                      data.news.length
                        ? 'Aucune actualité pour ce filtre'
                        : 'Le lieu a des histoires à raconter'
                    }
                    text={
                      data.news.length
                        ? 'Modifiez votre recherche ou la visibilité sélectionnée.'
                        : 'Un retour en images, une nouvelle exposition, un temps fort à annoncer. Partagez votre première actualité.'
                    }
                    action={
                      <button
                        className="mf-button"
                        onClick={() => setEditor({ kind: 'news' })}
                      >
                        <Plus size={17} />
                        Rédiger une actualité
                      </button>
                    }
                  />
                </section>
              )}
            </>
          )}
          {page === 'settings' && <Settings data={data} onSaved={refresh} />}
          <footer className="mf-footer">
            <span>Micro-Folie de Noisy-le-Sec</span>
            <span>Un lieu pour découvrir. Un espace pour le faire vivre.</span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="mf-toast" role="status">
          <span>
            <Check size={17} />
          </span>
          {notice}
          <button
            aria-label="Fermer la notification"
            onClick={() => setNotice('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {editor && (
        <ContentEditor
          key={editor.kind + (editor.item?.id ?? 'new')}
          {...editor}
          onClose={() => setEditor(null)}
          onSaved={refresh}
        />
      )}
      {selected && (
        <ReservationDetail
          reservation={selected}
          workshop={data.workshops.find((w) => w.id === selected.workshop_id)}
          emailConfigured={data.emailConfigured}
          onClose={() => setSelected(null)}
          onSaved={refresh}
        />
      )}
      <section className="mf-print">
        <h1>Micro-Folie · Liste de présence</h1>
        <p>
          {workshopFilter
            ? data.workshops.find((w) => w.id === workshopFilter)?.title
            : 'Tous les ateliers'}{' '}
          · Réservations confirmées
        </p>
        <table>
          <thead>
            <tr>
              <th>Participant</th>
              <th>Atelier</th>
              <th>Places</th>
              <th>Présence</th>
            </tr>
          </thead>
          <tbody>
            {data.reservations
              .filter(
                (r) =>
                  r.status === 'confirmed' &&
                  (!workshopFilter || r.workshop_id === workshopFilter),
              )
              .map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.first_name} {r.last_name}
                  </td>
                  <td>
                    {r.title} · {shortDate(r.starts_at)}
                  </td>
                  <td>{r.participants}</td>
                  <td>□</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
