import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
const base = '/micro-folie-noisy-le-sec';
const site = 'https://jaouadmerimi.github.io' + base + '/';
const html = readFileSync('site.html', 'utf8')
  .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${site}">`)
  .replaceAll('/assets/', base + '/assets/')
  .replace(/((?:src|href)=")\/(?!\/)/g, '$1' + base + '/')
  .replace(base + base + '/', base + '/')
  .replace('<script src="' + base + '/public-live.js"', '<script src="' + base + '/site-config.js"></script><script src="' + base + '/public-live.js"');
writeFileSync('../docs/index.html', html);
const shell = readFileSync('../docs/app.html', 'utf8');
for (const path of ['admin', 'admin/activation', 'admin/mot-de-passe', 'reservation']) {
  mkdirSync('../docs/' + path, { recursive: true });
  writeFileSync('../docs/' + path + '/index.html', shell);
}
unlinkSync('../docs/app.html');
writeFileSync('../docs/.nojekyll', '');
console.log('GitHub Pages pages generated in docs/');
