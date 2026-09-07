'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { api } from '../lib/http';
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
          redirectTo: window.location.origin + '/admin/mot-de-passe',
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
    <main className="admin-login">
      <div className="brand-mark">▦</div>
      <p className="eyebrow">MICRO-FOLIE · ÉQUIPE</p>
      <h1>
        {mode === 'activate'
          ? 'Bienvenue dans l’équipe'
          : token
            ? 'Nouveau mot de passe'
            : 'Mot de passe oublié'}
      </h1>
      <section className="panel">
        {error && (
          <p role="alert" className="error notice">
            {error}
          </p>
        )}
        {done ? (
          <p role="status" className="success notice">
            {done}
          </p>
        ) : (
          <form className="form-grid" onSubmit={submit}>
            {mode === 'activate' && (
              <label className="field-label">
                Votre nom
                <Input
                  name="name"
                  required
                  autoComplete="name"
                  maxLength={100}
                />
              </label>
            )}
            {mode === 'activate' || token ? (
              <label className="field-label">
                Mot de passe · 12 caractères minimum
                <Input
                  name="password"
                  type="password"
                  minLength={12}
                  maxLength={128}
                  required
                  autoComplete="new-password"
                />
              </label>
            ) : (
              <label className="field-label">
                Email
                <Input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
              </label>
            )}
            <Button
              type="submit"
              disabled={busy || (mode === 'activate' && !token)}
            >
              {busy
                ? 'En cours…'
                : mode === 'activate'
                  ? 'Activer mon compte'
                  : token
                    ? 'Enregistrer le mot de passe'
                    : 'Recevoir un lien'}
            </Button>
            {mode === 'activate' && !token && (
              <p>
                Ouvrez le lien personnel d’activation remis par le responsable.
              </p>
            )}
          </form>
        )}
      </section>
      <a className="text-link" href="/admin">
        ← Connexion à l’administration
      </a>
    </main>
  );
}
