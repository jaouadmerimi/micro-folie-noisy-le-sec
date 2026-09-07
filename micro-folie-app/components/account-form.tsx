'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Mark, Busy } from './admin/shared';
import './admin/studio.css';
import { api } from '../lib/http';
import { sitePath } from '../lib/urls';
export default function AccountForm({ mode }: { mode: 'activate' | 'reset' }) {
  const [token, setToken] = useState(''),
    [error, setError] = useState(''),
    [done, setDone] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setToken(
      mode === 'activate'
        ? window.location.hash.slice(1)
        : (new URLSearchParams(window.location.search).get('token') ?? ''),
    );
  }, [mode]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      if (mode === 'activate') {
        await api('activate', {
          token,
          name: f.get('name'),
          password: f.get('password'),
        });
        setDone(
          'Votre compte est activé. Vous pouvez vous connecter avec votre email et votre mot de passe.',
        );
      } else if (token) {
        await api('auth/reset-password', {
          token,
          newPassword: f.get('password'),
        });
        setDone(
          'Votre mot de passe est mis à jour. Vous pouvez vous connecter.',
        );
      } else {
        await api('auth/request-password-reset', {
          email: f.get('email'),
          redirectTo: window.location.origin + sitePath('/admin/mot-de-passe/'),
        });
        setDone(
          'Si un compte correspond et que l’envoi des emails est activé, vous recevrez un lien. Sinon, contactez le responsable du site.',
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="studio mf-account">
      <div className="mf-account-panel">
        <Mark />
        <p className="mf-eyebrow">MICRO-FOLIE · ÉQUIPE</p>
        <h1>
          {mode === 'activate'
            ? 'Bienvenue dans l’équipe'
            : token
              ? 'Nouveau mot de passe'
              : 'Mot de passe oublié'}
        </h1>
        <section>
          {error && (
            <p role="alert" className="mf-form-error">
              {error}
            </p>
          )}
          {done ? (
            <p role="status" className="mf-inline-note">
              {done}
            </p>
          ) : (
            <form onSubmit={submit}>
              {mode === 'activate' && (
                <label className="mf-field">
                  Votre nom
                  <input
                    name="name"
                    required
                    autoComplete="name"
                    maxLength={100}
                  />
                </label>
              )}
              {mode === 'activate' || token ? (
                <label className="mf-field">
                  Mot de passe · 10 caractères minimum
                  <input
                    name="password"
                    type="password"
                    minLength={10}
                    maxLength={128}
                    required
                    autoComplete="new-password"
                  />
                </label>
              ) : (
                <label className="mf-field">
                  Email
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                  />
                </label>
              )}
              <button
                className="mf-button"
                type="submit"
                disabled={busy || (mode === 'activate' && !token)}
              >
                {busy ? (
                  <Busy />
                ) : mode === 'activate' ? (
                  'Activer mon compte'
                ) : token ? (
                  'Enregistrer le mot de passe'
                ) : (
                  'Recevoir un lien'
                )}
              </button>
              {mode === 'activate' && !token && (
                <p>
                  Ouvrez le lien personnel d’activation remis par le
                  responsable.
                </p>
              )}
            </form>
          )}
        </section>
        <a className="mf-text-button" href={sitePath('/admin/')}>
          ← Connexion à l’administration
        </a>
      </div>
    </main>
  );
}
