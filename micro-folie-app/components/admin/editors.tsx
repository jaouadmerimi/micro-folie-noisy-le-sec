import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ImagePlus,
  Check,
  Eye,
  AlertCircle,
  Upload,
  Trash2,
} from 'lucide-react';
import { api, apiFetch } from '../../lib/http';
import { parisInput, parisToUTC } from '../../lib/dates';
import { PrivateImage } from '../private-image';
import {
  Drawer,
  Field,
  Busy,
  Badge,
  categories,
  type Workshop,
  type News,
} from './shared';

type Props = {
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
};
function Discard({
  onKeep,
  onDiscard,
}: {
  onKeep: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="mf-discard" role="alert">
      <strong>Fermer sans enregistrer ?</strong>
      <p>Les modifications de ce formulaire seront perdues.</p>
      <div>
        <button type="button" className="mf-button secondary" onClick={onKeep}>
          Continuer à modifier
        </button>
        <button type="button" className="mf-button danger" onClick={onDiscard}>
          Abandonner
        </button>
      </div>
    </div>
  );
}
export function ContentEditor({
  kind,
  item,
  onClose,
  onSaved,
}: Props & { kind: 'workshop' | 'news'; item?: Workshop | News }) {
  const isNews = kind === 'news';
  const discardRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<Record<string, any>>(() => ({
    title: '',
    description: '',
    body: '',
    category: 'Famille',
    capacity: 12,
    min_age: 0,
    status: 'draft',
    image_key: '',
    link: '',
    starts_at: '',
    ends_at: '',
    published_at: parisInput(new Date().toISOString()),
    ...item,
    ...(item
      ? {
          starts_at: parisInput((item as Workshop).starts_at),
          ends_at: parisInput((item as Workshop).ends_at),
          published_at: parisInput((item as News).published_at),
        }
      : {}),
  }));
  const [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [uploading, setUploading] = useState(false);
  const change = (key: string, value: string | number) => {
    setValues((v) => ({ ...v, [key]: value }));
    setDirty(true);
  };
  const close = () => {
    if (busy || uploading) return;
    dirty ? setDiscard(true) : onClose();
  };
  useEffect(() => {
    if (discard) {
      discardRef.current?.scrollIntoView({ block: 'start' });
      discardRef.current?.querySelector('button')?.focus();
    }
  }, [discard]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload: Record<string, any> = {
        ...values,
        ...(isNews
          ? { published_at: parisToUTC(values.published_at) }
          : {
              starts_at: parisToUTC(values.starts_at),
              ends_at: parisToUTC(values.ends_at),
            }),
      };
      if (!isNews && payload.ends_at <= payload.starts_at)
        throw new Error('La fin de l’atelier doit être après son début.');
      await api('admin/' + (isNews ? 'news' : 'workshops'), payload);
      setDirty(false);
      await onSaved(isNews ? 'Actualité enregistrée.' : 'Atelier enregistré.');
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      if (file.size > 3 * 1024 * 1024)
        throw new Error('La photo doit peser moins de 3 Mo.');
      const r = await apiFetch('upload', {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      const result = (await r.json()) as { error?: string; key: string };
      if (!r.ok)
        throw new Error(result.error ?? 'Impossible de charger la photo.');
      change('image_key', result.key);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  const action =
    values.status === 'draft'
      ? 'Enregistrer le brouillon'
      : values.status === 'archived'
        ? 'Archiver'
        : isNews && values.published_at > parisInput(new Date().toISOString())
          ? 'Programmer la publication'
          : item
            ? 'Enregistrer les modifications'
            : isNews
              ? 'Publier l’actualité'
              : 'Publier l’atelier';
  return (
    <Drawer
      title={
        (item ? 'Modifier' : 'Créer') +
        (isNews ? ' une actualité' : ' un atelier')
      }
      subtitle={isNews ? 'LES NOUVELLES DU LIEU' : 'LE PROGRAMME'}
      onClose={close}
      wide={isNews}
    >
      <form className="mf-editor-form" onSubmit={submit}>
        <div className={'mf-editor-body' + (isNews ? ' with-preview' : '')}>
          <div className="mf-editor-fields">
            {discard && (
              <div ref={discardRef}>
                <Discard onKeep={() => setDiscard(false)} onDiscard={onClose} />
              </div>
            )}
            <section>
              <div className="mf-form-section">
                <span>01</span>
                <h3>{isNews ? 'Votre histoire' : 'L’essentiel'}</h3>
              </div>
              <Field
                label={isNews ? 'Titre de l’actualité' : 'Nom de l’atelier'}
              >
                <input
                  autoComplete="off"
                  required
                  maxLength={180}
                  value={values.title}
                  onChange={(e) => change('title', e.target.value)}
                  placeholder={
                    isNews
                      ? 'Une nouvelle à partager…'
                      : 'Ex. Fabrique ton premier objet en 3D'
                  }
                />
              </Field>
              <Field
                label={isNews ? 'Texte de l’actualité' : 'Description'}
                hint={
                  isNews
                    ? 'Le texte apparaîtra tel quel sur le site.'
                    : 'Présentez l’activité et ce que les participants vont découvrir.'
                }
              >
                <textarea
                  required
                  rows={isNews ? 8 : 4}
                  maxLength={isNews ? 12000 : 5000}
                  value={values[isNews ? 'body' : 'description']}
                  onChange={(e) =>
                    change(isNews ? 'body' : 'description', e.target.value)
                  }
                  placeholder={
                    isNews
                      ? 'Racontez la vie de la Micro-Folie…'
                      : 'Ce qui attend les participants…'
                  }
                />
              </Field>
              {!isNews && (
                <Field label="Catégorie">
                  <select
                    value={values.category}
                    onChange={(e) => change('category', e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              )}
            </section>
            {isNews ? (
              <section>
                <div className="mf-form-section">
                  <span>02</span>
                  <h3>Photo & lien</h3>
                </div>
                <label className={'mf-upload' + (uploading ? ' busy' : '')}>
                  <Upload size={22} />
                  <strong>
                    {uploading
                      ? 'Ajout de la photo…'
                      : values.image_key
                        ? 'Choisir une autre photo'
                        : 'Ajouter une photo'}
                  </strong>
                  <small>JPEG, PNG ou WebP · 3 Mo maximum</small>
                  <input
                    aria-label="Ajouter une photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy || uploading}
                    onChange={(e) => void upload(e.target.files?.[0])}
                  />
                </label>
                {values.image_key && (
                  <button
                    className="mf-text-button danger-text"
                    type="button"
                    disabled={uploading || busy}
                    onClick={() => change('image_key', '')}
                  >
                    <Trash2 size={14} />
                    Retirer la photo
                  </button>
                )}
                <Field
                  label="Lien pour en savoir plus"
                  hint="Facultatif · une adresse qui commence par https://"
                >
                  <input
                    type="url"
                    value={values.link}
                    onChange={(e) => change('link', e.target.value)}
                    placeholder="https://…"
                  />
                </Field>
              </section>
            ) : (
              <section>
                <div className="mf-form-section">
                  <span>02</span>
                  <h3>Date & participants</h3>
                </div>
                <div className="mf-form-grid">
                  <Field label="Début" hint="Heure de Paris">
                    <input
                      type="datetime-local"
                      required
                      value={values.starts_at}
                      onInput={(e) => {
                        change('starts_at', e.currentTarget.value);
                        if (!values.ends_at && e.currentTarget.value) {
                          const local = new Date(
                            Date.parse(e.currentTarget.value + 'Z') + 3600000,
                          )
                            .toISOString()
                            .slice(0, 16);
                          change('ends_at', local);
                        }
                      }}
                    />
                  </Field>
                  <Field label="Fin" hint="Heure de Paris">
                    <input
                      type="datetime-local"
                      required
                      value={values.ends_at}
                      onInput={(e) => change('ends_at', e.currentTarget.value)}
                    />
                  </Field>
                  <Field label="Nombre de places">
                    <input
                      type="number"
                      min={1}
                      max={500}
                      required
                      value={values.capacity}
                      onChange={(e) => change('capacity', e.target.value)}
                    />
                  </Field>
                  <Field label="Âge minimum" hint="0 pour tous les âges">
                    <input
                      type="number"
                      min={0}
                      max={110}
                      required
                      value={values.min_age}
                      onChange={(e) => change('min_age', e.target.value)}
                    />
                  </Field>
                </div>
                {item && (item as Workshop).occupied > 0 && (
                  <p className="mf-inline-note">
                    Des places sont déjà retenues. Les horaires et le titre sont
                    protégés tant que des demandes sont actives.
                  </p>
                )}
              </section>
            )}
            <section>
              <div className="mf-form-section">
                <span>03</span>
                <h3>Visibilité</h3>
              </div>
              <Field label="Statut de publication">
                <select
                  value={values.status}
                  onChange={(e) => change('status', e.target.value)}
                >
                  <option value="draft">
                    Brouillon · visible uniquement par l’équipe
                  </option>
                  <option value="published">
                    Publié · visible sur le site
                  </option>
                  {item && (
                    <option value="archived">Archivé · retiré du site</option>
                  )}
                </select>
              </Field>
              {isNews && (
                <Field
                  label="Date de publication"
                  hint="Une date future programme la publication. Heure de Paris."
                >
                  <input
                    type="datetime-local"
                    required
                    value={values.published_at}
                    onInput={(e) =>
                      change('published_at', e.currentTarget.value)
                    }
                  />
                </Field>
              )}
              <p className="mf-inline-note">
                {values.status === 'draft'
                  ? 'Vous pourrez publier ce brouillon quand il sera prêt.'
                  : values.status === 'archived'
                    ? 'Ce contenu ne sera plus affiché sur le site.'
                    : isNews
                      ? 'Cette actualité apparaîtra à la date choisie.'
                      : 'Cet atelier apparaîtra dans l’agenda et ouvrira les réservations.'}
              </p>
            </section>
          </div>
          {isNews && (
            <aside className="mf-preview">
              <p>
                <Eye size={15} />
                Aperçu du contenu
              </p>
              <article>
                {values.image_key ? (
                  <PrivateImage imageKey={values.image_key} />
                ) : (
                  <div className="mf-preview-placeholder">
                    <ImagePlus size={35} />
                    <span>Votre photo ici</span>
                  </div>
                )}
                <div>
                  <Badge status={values.status} />
                  <h3>{values.title || 'Le titre de votre actualité'}</h3>
                  <p>
                    {values.body ||
                      'Votre texte prendra place ici. L’aperçu se met à jour pendant la rédaction.'}
                  </p>
                  {values.link && (
                    <span className="mf-preview-link">En savoir plus ↗</span>
                  )}
                </div>
              </article>
              <small>Un aperçu pour relire avant de publier.</small>
            </aside>
          )}
        </div>
        <footer className="mf-editor-footer">
          {error && (
            <p className="mf-form-error" role="alert">
              <AlertCircle size={17} />
              {error}
            </p>
          )}
          <div>
            <span className="mf-save-state">
              {dirty ? 'Modifications non enregistrées' : 'Aucune modification'}
            </span>
            <button
              type="button"
              className="mf-button secondary"
              onClick={close}
              disabled={busy || uploading}
            >
              Fermer
            </button>
            <button
              type="submit"
              className="mf-button"
              disabled={busy || uploading}
            >
              {busy ? (
                <Busy />
              ) : (
                <>
                  <Check size={17} />
                  {action}
                </>
              )}
            </button>
          </div>
        </footer>
      </form>
    </Drawer>
  );
}
