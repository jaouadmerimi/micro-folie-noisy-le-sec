export function parisInput(iso: string) {
  if (!iso) return '';
  const p = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
  return p.replace(' ', 'T');
}
export function parisToUTC(value: string) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))
    throw new Error('Indiquez une date et une heure.');
  const naive = Date.parse(value + 'Z');
  let estimate = naive;
  for (let i = 0; i < 3; i++) {
    const displayed = Date.parse(
      parisInput(new Date(estimate).toISOString()) + 'Z',
    );
    estimate += naive - displayed;
  }
  const iso = new Date(estimate).toISOString();
  if (parisInput(iso) !== value)
    throw new Error(
      'Cette heure n’existe pas lors du changement d’heure. Choisissez un autre horaire.',
    );
  return iso;
}
export function formatDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}
