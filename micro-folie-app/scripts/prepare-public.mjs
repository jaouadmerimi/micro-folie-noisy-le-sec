import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const original = readFileSync('source/original-site.html', 'utf8');
let html = JSON.parse(
  original.match(
    /<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/,
  )[1],
);
const manifest = JSON.parse(
  original.match(
    /<script type="__bundler\/manifest">\s*([\s\S]*?)\s*<\/script>/,
  )[1],
);
html = html.replace(/<div id="tweaks-root">[\s\S]*$/, '</body></html>');
mkdirSync('public/assets', { recursive: true });
for (const [id, a] of Object.entries(manifest)) {
  if (!html.includes(id)) continue;
  const ext =
    {
      'text/javascript': 'js',
      'text/css': 'css',
      'font/woff2': 'woff2',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
    }[a.mime] ?? 'bin';
  let bytes = Buffer.from(a.data, 'base64');
  if (a.compressed) bytes = gunzipSync(bytes);
  writeFileSync(`public/assets/${id}.${ext}`, bytes);
  html = html.replaceAll(id, `/assets/${id}.${ext}`);
}
html = html.replace(
  /<section class="section agenda" id="agenda">[\s\S]*?<\/section>/,
  `<section class="section agenda" id="agenda"><div class="wrap"><p class="eyebrow">Agenda</p><h2>Que faire à la Micro-Folie ?</h2><p>Des rendez-vous gratuits. Les horaires sont indiqués à l’heure de Paris.</p><div id="agendaFilters" class="live-filters" role="group" aria-label="Filtrer l’agenda"></div><div class="agenda-grid" id="agendaGrid" aria-live="polite"><p>Chargement du programme…</p></div></div></section>`,
);
html = html.replace(
  /<section class="section" id="reserver">[\s\S]*?<\/section>/,
  `<section class="section" id="reserver"><div class="wrap"><p class="eyebrow">Réserver</p><h2>Votre prochain atelier commence ici.</h2><p>Gratuit et sans compte. L’équipe confirme chaque demande selon les places disponibles.</p><form id="reserveForm" class="live-form"><label>Atelier souhaité<select id="atelier" name="atelier" required><option value="">Chargement des ateliers…</option></select></label><div class="live-row"><label>Prénom<input name="firstName" required maxlength="80" autocomplete="given-name"></label><label>Nom<input name="lastName" required maxlength="80" autocomplete="family-name"></label></div><div class="live-row"><label>Email<input name="email" type="email" required maxlength="254" autocomplete="email"></label><label>Téléphone (facultatif)<input name="phone" type="tel" maxlength="35" autocomplete="tel"></label></div><label>Nombre de participants<input name="participants" type="number" min="1" max="10" value="1" required></label><label class="live-honey" aria-hidden="true">Site internet<input name="website" tabindex="-1" autocomplete="off"></label><label class="live-consent"><input type="checkbox" name="consent" required> J’accepte que mes coordonnées soient utilisées par l’équipe pour traiter cette réservation.</label><p class="live-help">Les places disponibles sont retenues pendant 48 heures maximum, dans l’attente de la validation de l’équipe. Un atelier complet reste accessible en liste d’attente. Pour plus de 10 participants, contactez-nous.</p><button type="submit" class="btn btn-primary" id="reserveSubmit" disabled>Envoyer ma demande</button><div id="formOk" role="status" aria-live="polite"></div><p class="form-note">Téléphone : <a href="tel:+33149426719">01 49 42 67 19</a> · <a href="mailto:micro-folie@noisylesec.fr">micro-folie@noisylesec.fr</a></p><p class="live-help">Vos coordonnées sont réservées à l’équipe et aux prestataires nécessaires au traitement de votre demande. Pour demander leur suppression, contactez la Micro-Folie à l’adresse ci-dessus.</p></form></div></section>`,
);
html = html.replace(
  /<section class="section" id="actualites">[\s\S]*?<\/section>/,
  `<section class="section" id="actualites"><div class="wrap"><p class="eyebrow">Actualités</p><h2>Les nouvelles du lieu</h2><div class="actus-grid" id="actusGrid" aria-live="polite"><p>Chargement des actualités…</p></div></div></section>`,
);
html = html.replace(
  /\/\* ---- form submit ---- \*\/[\s\S]*?(?=\/\* ---- reveal)/,
  '',
);
html = html.replace(
  /<!-- ============ ACTUALITÉS \(chargées depuis Google Sheet CSV\)[\s\S]*?<\/script>/,
  '',
);
html = html
  .replace('MICRO / MACRO 2026', 'MICRO / MACRO 2026 · édition passée')
  .replace('Candidater par mail', 'Contacter l’équipe')
  .replace(
    'Candidatures par mail · réponse de l’équipe sous quinzaine',
    'Édition février–juillet 2026. Contactez l’équipe pour les prochains appels à projets.',
  );
html = html.replace(
  '</head>',
  '<link rel="stylesheet" href="/public-live.css"><link rel="canonical" href="https://micro-folie-noisy-le-sec.jaouad-merimi.chatgpt.site/"></head>',
);
html = html.replace(
  '</body>',
  '<p style="text-align:center;padding:18px"><a href="/admin">Espace équipe</a></p><script src="/public-live.js" defer></script></body>',
);
writeFileSync('site.html', html);
console.log('Site public extrait et raccordé aux données.');
