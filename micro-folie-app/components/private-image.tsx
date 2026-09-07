import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/http';
export function PrivateImage({ imageKey }: { imageKey: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let active = true, objectUrl = '';
    setSrc('');
    apiFetch('image/' + encodeURIComponent(imageKey)).then(async response => {
      if (!response.ok) return;
      const blob = await response.blob();
      if (active) { objectUrl = URL.createObjectURL(blob); setSrc(objectUrl); }
    }).catch(() => {});
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [imageKey]);
  return src ? <img src={src} alt="Photo de l’actualité" /> : <p>Chargement de la photo…</p>;
}
