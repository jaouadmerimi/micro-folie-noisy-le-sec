import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X, ArrowUpRight, LoaderCircle, ArrowRight, Inbox } from 'lucide-react';
import { sitePath } from '../../lib/urls';

export type Workshop = {
  id: string;
  title: string;
  description: string;
  category: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  occupied: number;
  min_age: number;
  status: string;
  version: number;
};
export type News = {
  id: string;
  title: string;
  body: string;
  image_key: string;
  link: string;
  published_at: string;
  status: string;
  version: number;
};
export type Reservation = {
  id: string;
  reference: string;
  workshop_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  title: string;
  starts_at: string;
  participants: number;
  status: string;
  hold_until: string;
  created_at: string;
  version: number;
};
export type AdminData = {
  workshops: Workshop[];
  news: News[];
  reservations: Reservation[];
  mail: {
    id: string;
    subject: string;
    status: string;
    attempts: number;
    last_error: string;
  }[];
  admins: { email: string }[];
  isOwner: boolean;
  ownerEmail?: string;
  emailConfigured: boolean;
  emailFrom: string;
};
export const labels: Record<string, string> = {
  pending: 'À confirmer',
  waitlist: 'Liste d’attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
  refused: 'Refusée',
  expired: 'Expirée',
  draft: 'Brouillon',
  published: 'Publié',
  archived: 'Archivé',
};
export const categories = [
  'Famille',
  'FabLab',
  'Cuisine',
  'Jardin',
  'Musée numérique',
  'Événement',
];
export const shortDate = (
  iso: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
) =>
  iso
    ? new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        ...options,
      }).format(new Date(iso))
    : 'À définir';
export const time = (iso: string) =>
  shortDate(iso, { hour: '2-digit', minute: '2-digit' });
export function Mark() {
  return (
    <span className="mf-mark" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}
export function Badge({ status }: { status: string }) {
  return (
    <span className={'mf-badge ' + status}>
      <i />
      {labels[status] ?? status}
    </span>
  );
}
export function Busy({ children }: { children?: ReactNode }) {
  return (
    <>
      <LoaderCircle size={16} className="mf-spin" />
      {children ?? 'Enregistrement…'}
    </>
  );
}
export function SiteLink() {
  return (
    <a
      className="mf-site-link"
      href={sitePath('/')}
      target="_blank"
      rel="noreferrer"
    >
      Voir le site <ArrowUpRight size={15} />
    </a>
  );
}
export function Empty({
  title,
  text,
  action,
  icon,
}: {
  title: string;
  text: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mf-empty">
      <div className="mf-empty-icon">{icon ?? <Inbox size={28} />}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Field({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={'mf-field' + (wide ? ' mf-wide' : '')}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Drawer({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    id = useId();
  useEffect(() => {
    const node = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    node?.showModal();
    heading.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      node?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={'mf-dialog' + (wide ? ' mf-dialog-wide' : '')}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mf-dialog-inner">
        <header className="mf-dialog-head">
          <div>
            <p>{subtitle ?? 'MICRO-FOLIE · ÉQUIPE'}</p>
            <h2 id={id} ref={heading} tabIndex={-1}>
              {title}
            </h2>
          </div>
          <button
            className="mf-icon-button"
            aria-label="Fermer le panneau"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function ArrowButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="mf-text-button" onClick={onClick}>
      {children}
      <ArrowRight size={16} />
    </button>
  );
}
