import { useState } from 'react';
import {
  Mail,
  Users,
  Check,
  Copy,
  ArrowUpRight,
  RefreshCw,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../lib/http';
import { Field, Busy, Empty, type AdminData } from './shared';
export function Settings({
  data,
  onSaved,
}: {
  data: AdminData;
  onSaved: (message: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [invite, setInvite] = useState(''),
    [copied, setCopied] = useState(false),
    [removing, setRemoving] = useState('');
  async function run(key: string, task: () => Promise<void>) {
    setBusy(key);
    setError('');
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <div className="mf-settings">
      {error && (
        <p className="mf-form-error" role="alert">
          {error}
        </p>
      )}
      <section className="mf-card">
        <header className="mf-card-header">
          <div className="mf-heading-icon">
            <Mail size={20} />
            <div>
              <h2>Les emails aux participants</h2>
              <p>Demandes reçues, confirmations et annulations.</p>
            </div>
          </div>
          <span
            className={
              'mf-badge ' + (data.emailConfigured ? 'published' : 'pending')
            }
          >
            <i />
            {data.emailConfigured ? 'Activés' : 'À configurer'}
          </span>
        </header>
        <div className="mf-card-body">
          {data.isOwner ? (
            <>
              <p className="mf-settings-intro">
                Connectez votre expéditeur pour que les participants reçoivent
                automatiquement les messages liés à leur réservation.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fields = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  void run('email', async () => {
                    await api('admin/mail/config', fields);
                    await onSaved('Expéditeur enregistré.');
                  });
                }}
              >
                <div className="mf-form-grid">
                  <Field label="Adresse d’envoi">
                    <input
                      type="email"
                      name="from"
                      required
                      defaultValue={data.emailFrom}
                      placeholder="reservations@votre-domaine.fr"
                    />
                  </Field>
                  <Field
                    label="Clé API Resend"
                    hint={
                      data.emailConfigured
                        ? 'Laisser vide pour conserver la clé actuelle.'
                        : 'Disponible dans votre espace Resend.'
                    }
                  >
                    <input
                      type="password"
                      name="key"
                      required={!data.emailConfigured}
                      autoComplete="off"
                      placeholder={
                        data.emailConfigured ? 'Clé enregistrée' : 're_…'
                      }
                    />
                  </Field>
                </div>
                <div className="mf-settings-footer">
                  <a
                    href="https://resend.com/domains"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Configurer mon domaine dans Resend{' '}
                    <ArrowUpRight size={14} />
                  </a>
                  <button className="mf-button" disabled={!!busy}>
                    {busy === 'email' ? <Busy /> : 'Enregistrer l’expéditeur'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <p>Le responsable de l’équipe peut configurer l’expéditeur.</p>
          )}
        </div>
      </section>
      <section className="mf-card">
        <header className="mf-card-header">
          <div>
            <h2>
              Messages en attente{' '}
              <span className="mf-count">{data.mail.length}</span>
            </h2>
            <p>Relancez les messages après avoir configuré l’expéditeur.</p>
          </div>
          <button
            className="mf-button secondary"
            disabled={!!busy || !data.mail.length || !data.emailConfigured}
            onClick={() =>
              void run('retry', async () => {
                const r = await api('admin/mail/retry', {});
                await onSaved(
                  `${r.sent ?? 0} message(s) transmis au service d’envoi.`,
                );
              })
            }
          >
            {busy === 'retry' ? (
              <Busy />
            ) : (
              <>
                <RefreshCw size={16} />
                Relancer les envois
              </>
            )}
          </button>
        </header>
        {data.mail.length ? (
          <div className="mf-message-list">
            {data.mail.map((m) => (
              <div key={m.id}>
                <Mail size={17} />
                <div>
                  <strong>{m.subject}</strong>
                  <small>
                    {m.last_error ||
                      `${m.attempts} tentative(s) · ${m.status === 'sending' ? 'En cours' : 'En attente'}`}
                  </small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            icon={<Check size={28} />}
            title="Aucun message en attente"
            text="Les messages qui demandent votre attention apparaîtront ici."
          />
        )}
      </section>
      {data.isOwner && (
        <section className="mf-card">
          <header className="mf-card-header">
            <div className="mf-heading-icon">
              <Users size={20} />
              <div>
                <h2>Votre équipe</h2>
                <p>Un accès personnel pour chaque membre.</p>
              </div>
            </div>
          </header>
          <div className="mf-card-body">
            <div className="mf-member">
              <span className="mf-avatar">JM</span>
              <div>
                <strong>{data.ownerEmail}</strong>
                <small>Responsable de la Micro-Folie</small>
              </div>
              <ShieldCheck size={18} />
            </div>
            {data.admins.map((a) => (
              <div className="mf-member" key={a.email}>
                <span className="mf-avatar pale">
                  {a.email.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>{a.email}</strong>
                  <small>Membre de l’équipe</small>
                </div>
                {removing === a.email ? (
                  <div className="mf-inline-actions">
                    <button
                      className="mf-button secondary"
                      disabled={!!busy}
                      onClick={() => setRemoving('')}
                    >
                      Garder l’accès
                    </button>
                    <button
                      className="mf-button danger"
                      disabled={!!busy}
                      onClick={() =>
                        void run('revoke', async () => {
                          await api('admin/revoke', { email: a.email });
                          await onSaved('Accès retiré.');
                          setRemoving('');
                        })
                      }
                    >
                      Confirmer le retrait
                    </button>
                  </div>
                ) : (
                  <button
                    className="mf-text-button danger-text"
                    onClick={() => setRemoving(a.email)}
                  >
                    Retirer l’accès
                  </button>
                )}
              </div>
            ))}
            <form
              className="mf-invite-form"
              onSubmit={(e) => {
                e.preventDefault();
                const email = new FormData(e.currentTarget).get('email');
                void run('invite', async () => {
                  const r = await api('admin/invite', { email });
                  setInvite(r.url);
                  setCopied(false);
                  await onSaved('Lien d’invitation créé.');
                });
              }}
            >
              <Field label="Inviter un membre">
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="prenom@exemple.fr"
                />
              </Field>
              <button className="mf-button secondary" disabled={!!busy}>
                {busy === 'invite' ? (
                  <Busy />
                ) : (
                  <>
                    <UserPlus size={16} />
                    Créer une invitation
                  </>
                )}
              </button>
            </form>
            {invite && (
              <div className="mf-invitation" role="status">
                <strong>L’invitation est prête</strong>
                <p>
                  Transmettez ce lien à la personne concernée. Il est valable 7
                  jours, pour une seule activation.
                </p>
                <div>
                  <input
                    readOnly
                    aria-label="Lien d’invitation"
                    value={invite}
                  />
                  <button
                    type="button"
                    className="mf-button secondary"
                    onClick={() =>
                      void run('copy', async () => {
                        await navigator.clipboard.writeText(invite);
                        setCopied(true);
                      })
                    }
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
                    {copied ? 'Copié' : 'Copier'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
