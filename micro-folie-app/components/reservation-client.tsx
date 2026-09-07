'use client';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { api } from '../lib/http';
import { sitePath } from '../lib/urls';
import { formatDate } from '../lib/dates';
const labels: Record<string, string> = {
  pending: 'Demande en attente de confirmation',
  waitlist: 'Vous êtes en liste d’attente',
  confirmed: 'Votre réservation est confirmée',
  refused: 'Votre demande n’a pas été retenue',
  cancelled: 'Votre réservation est annulée',
  expired: 'Le délai de confirmation est dépassé',
};
export default function ReservationClient() {
  const [token, setToken] = useState(''),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = window.location.hash.slice(1);
    setToken(t);
    api('reservation', { token: t })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  async function cancel() {
    if (!window.confirm('Annuler votre demande et libérer les places ?'))
      return;
    setBusy(true);
    setError('');
    try {
      await api('reservation', { token, action: 'cancel' });
      setData(await api('reservation', { token }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-login">
      <div className="brand-mark">▦</div>
      <p className="eyebrow">MICRO-FOLIE · NOISY-LE-SEC</p>
      <h1>Votre réservation</h1>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {data ? (
        <section className="panel">
          <p className={'status ' + data.status}>{labels[data.status]}</p>
          <h2>{data.title}</h2>
          <p>
            {formatDate(data.starts_at)} · {data.participants} personne(s)
          </p>
          <p>
            Référence : <strong>{data.reference}</strong>
          </p>
          {data.status === 'pending' && (
            <p>
              Les places sont retenues jusqu’au {formatDate(data.hold_until)}.
              Seule la confirmation de l’équipe garantit votre inscription.
            </p>
          )}
          {data.status === 'expired' && (
            <p>
              Contactez l’équipe ou effectuez une nouvelle demande s’il reste
              des places.
            </p>
          )}
          {['pending', 'waitlist', 'confirmed'].includes(data.status) && (
            <Button variant="outline" disabled={busy} onClick={cancel}>
              Annuler ma demande
            </Button>
          )}
        </section>
      ) : (
        !error && <p role="status">Chargement…</p>
      )}
      <p>
        Une question ? <a href="tel:+33149426719">01 49 42 67 19</a>
      </p>
      <a className="text-link" href={sitePath('/')}>
        ← Retour à la Micro-Folie
      </a>
    </main>
  );
}
