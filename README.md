# Micro-Folie Noisy-le-Sec

Site public, agenda, réservations et administration de l’équipe.

- Site : https://jaouadmerimi.github.io/micro-folie-noisy-le-sec/
- Administration : https://jaouadmerimi.github.io/micro-folie-noisy-le-sec/admin/
- Serveur : projet `micro-folie-api` sur le compte Vercel `jaouad-merimi`, avec une base Neon dédiée.

L’administration utilise des comptes individuels par email et mot de passe. Les visiteurs réservent sans compte et obtiennent un lien personnel de suivi et d’annulation.

GitHub Pages publie le dossier `docs/` de la branche `main`. Le site et l’administration restent sur cette adresse : aucune redirection vers ChatGPT. Les appels de données passent par le serveur Vercel avec contrôle de session et d’origine.

Le code des pages est dans `micro-folie-app/` ; lancer `npm run build:pages` dans ce dossier pour régénérer `docs/`. Le serveur est documenté dans [micro-folie-server](micro-folie-server/README.md). La version visuelle d’origine est conservée dans `micro-folie-app/source/original-site.html`.

Le compte responsable est créé côté serveur avec le mot de passe choisi par le propriétaire, jamais enregistré dans ce dépôt. Le responsable crée les prochaines dates et configure Resend dans **Équipe & emails**. Tant que l’expéditeur n’est pas configuré, les demandes sont enregistrées et les emails restent en attente ; le site l’indique aux visiteurs. Les données de test sont créées dans un schéma PostgreSQL isolé, supprimé après les tests.
