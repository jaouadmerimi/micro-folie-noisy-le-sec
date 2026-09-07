import { useState } from 'react';
import {
  Mail,
  Phone,
  CalendarDays,
  Users,
  Check,
  X,
  AlertCircle,
  Clock3,
} from 'lucide-react';
import { api } from '../../lib/http';
import {
  Drawer,
  Badge,
  Busy,
  shortDate,
  time,
  type Reservation,
  type Workshop,
} from './shared';
export function ReservationDetail({
  reservation: r,
  workshop,
  onClose,
  onSaved,
  emailConfigured,
}: {
  reservation: Reservation;
  workshop?: Workshop;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
  emailConfigured: boolean;
}) {
  const [action, setAction] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const available = workshop
    ? Number(workshop.capacity) -
      Number(workshop.occupied) +
      (r.status === 'pending' ? Number(r.participants) : 0)
    : null;
  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api('admin/reservations', {
        id: r.id,
        version: r.version,
        status: action,
      });
      await onSaved(
        action === 'confirmed'
          ? 'Réservation confirmée.'
          : action === 'refused'
            ? 'Demande refusée.'
            : 'Réservation annulée.',
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Drawer
      title={`${r.first_name} ${r.last_name}`}
      subtitle={'RÉSERVATION ' + r.reference}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="mf-detail-body">
        <Badge status={r.status} />
        <div className="mf-detail-event">
          <CalendarDays size={22} />
          <div>
            <h3>{r.title}</h3>
            <p>
              {shortDate(r.starts_at, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}{' '}
              à {time(r.starts_at)}
            </p>
            <span>
              <Users size={15} />
              {r.participants} {r.participants > 1 ? 'personnes' : 'personne'}
            </span>
          </div>
        </div>
        <h3 className="mf-detail-label">Coordonnées</h3>
        <a className="mf-contact" href={'mailto:' + r.email}>
          <Mail size={18} />
          <span>
            <small>Email</small>
            {r.email}
          </span>
        </a>
        {r.phone && (
          <a className="mf-contact" href={'tel:' + r.phone}>
            <Phone size={18} />
            <span>
              <small>Téléphone</small>
              {r.phone}
            </span>
          </a>
        )}
        <div className="mf-detail-info">
          <Clock3 size={18} />
          <p>
            Demande reçue le{' '}
            {shortDate(r.created_at, { day: 'numeric', month: 'long' })}.
            {r.status === 'pending' && (
              <>
                {' '}
                Les places sont retenues jusqu’au{' '}
                <strong>
                  {shortDate(r.hold_until)} à {time(r.hold_until)}
                </strong>
                .
              </>
            )}
          </p>
        </div>
        {r.status === 'waitlist' && available !== null && (
          <p className="mf-inline-note">
            {available >= r.participants
              ? `${available} place(s) disponible(s) : cette demande peut être confirmée.`
              : `${available} place(s) disponible(s) pour ${r.participants} demandée(s).`}
          </p>
        )}
        {!emailConfigured && (
          <p className="mf-inline-note">
            <Mail size={15} />
            Les emails sont désactivés. Prévenez directement le participant
            après votre décision.
          </p>
        )}
        {error && (
          <p className="mf-form-error" role="alert">
            <AlertCircle size={16} />
            {error}
          </p>
        )}
        {action && (
          <div
            className={
              'mf-decision ' + (action === 'confirmed' ? 'confirm' : '')
            }
            role="alert"
          >
            <h3>
              {action === 'confirmed'
                ? `Confirmer ${r.participants} place(s) ?`
                : action === 'refused'
                  ? 'Refuser cette demande ?'
                  : 'Annuler cette réservation ?'}
            </h3>
            <p>
              {action === 'confirmed'
                ? 'La réservation sera validée pour cet atelier.'
                : 'Les places éventuellement retenues seront libérées.'}
            </p>
            <div className="mf-inline-actions">
              <button
                className="mf-button secondary"
                onClick={() => setAction('')}
                disabled={busy}
              >
                Revenir
              </button>
              <button
                className={
                  'mf-button ' + (action === 'confirmed' ? '' : 'danger')
                }
                disabled={busy}
                onClick={() => void submit()}
              >
                {busy ? <Busy /> : 'Valider la décision'}
              </button>
            </div>
          </div>
        )}
      </div>
      <footer className="mf-editor-footer">
        <div>
          {!action && ['pending', 'waitlist'].includes(r.status) ? (
            <>
              <button
                className="mf-button secondary"
                onClick={() => setAction('refused')}
              >
                <X size={17} />
                Refuser
              </button>
              <button
                className="mf-button"
                disabled={
                  r.status === 'waitlist' &&
                  available !== null &&
                  available < r.participants
                }
                onClick={() => setAction('confirmed')}
              >
                <Check size={17} />
                Confirmer la réservation
              </button>
            </>
          ) : !action && r.status === 'confirmed' ? (
            <button
              className="mf-button danger"
              onClick={() => setAction('cancelled')}
            >
              Annuler la réservation
            </button>
          ) : (
            <button
              className="mf-button secondary"
              disabled={busy}
              onClick={onClose}
            >
              Fermer
            </button>
          )}
        </div>
      </footer>
    </Drawer>
  );
}
