# Serveur Micro-Folie

API Node.js sur Vercel (`micro-folie-api`, équipe `jaouad-merimi`). Base PostgreSQL Neon dédiée (`micro-folie-db`, offre Free, région Francfort). Les pages et l’administration sont hébergées par GitHub Pages.

L’authentification Better Auth utilise des sessions signées valables 8 heures, transmises par en-tête Authorization. Le navigateur les conserve uniquement dans sessionStorage, puis les efface à la déconnexion. Aucune dépendance aux cookies tiers. Le mot de passe est haché côté serveur ; les nouvelles inscriptions publiques sont bloquées. Les nouveaux membres utilisent un lien d’invitation personnel.

Les opérations de réservation sont transactionnelles. Un verrou PostgreSQL pris uniquement pendant les modifications sérialise les décisions de capacité entre instances Vercel ; il n’est pas maintenu pendant l’envoi d’emails. Les photos limitées à 3 Mo sont conservées dans la base, et les photos des brouillons exigent une session autorisée.

Variables nécessaires : `DATABASE_URL`, `SITE_URL`, `API_URL`, `ADMIN_EMAIL`, `AUTH_SECRET`, `ENCRYPTION_KEY`. `DATABASE_URL_UNPOOLED` est également utilisé pour isoler les tests dans un schéma temporaire. Les secrets se gèrent avec `vercel env`, sans les versionner. Le service email Resend se configure dans l’administration ; la file persistante et les relances sont décrites dans le README des pages.

```powershell
npm ci
vercel env pull .env.production.local --environment production --yes
npm run check
npm run migrate
npm test
vercel deploy --prod --yes --scope jaouad-merimi
```

`npm test` crée un schéma temporaire, teste l’authentification et les réservations simultanées puis supprime ce seul schéma. Il ne modifie pas les tables de production. La migration initiale ne doit plus être modifiée : ajouter une migration pour toute évolution ultérieure.

Pour une installation neuve uniquement, `scripts/create-owner.mjs` lit le mot de passe sur son entrée standard et crée le premier compte. Il refuse de remplacer un compte existant. Aucun secret d’activation initial n’est exposé sur le serveur en production.
