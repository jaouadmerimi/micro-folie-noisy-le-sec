# Micro-Folie Noisy-le-Sec

Site public, agenda, réservations et administration de l’équipe. L’apparence du site d’origine est conservée. L’administration utilise des comptes individuels par email et mot de passe ; aucun compte ChatGPT n’est requis dans l’application.

## Utilisation

- `/` : présentation du lieu, ateliers futurs publiés, actualités publiées et demande de réservation sans compte.
- `/admin` : connexion, ateliers, réservations, actualités, emails et accès de l’équipe.
- `/admin/activation#…` : lien personnel à usage unique, valable 7 jours, pour choisir son mot de passe.
- `/admin/mot-de-passe` : récupération du mot de passe, une fois le service email configuré.
- `/reservation#…` : suivi et annulation d’une demande grâce à un lien confidentiel.

Chaque atelier dispose d’une capacité. Une demande retient des places pendant 48 heures au maximum, sans dépasser le début de l’atelier. Si la capacité est insuffisante, la demande rejoint la liste d’attente. L’équipe confirme explicitement les demandes. Les contrôles de capacité s’exécutent dans les instructions SQL de modification pour protéger contre les demandes simultanées. Une réservation annulée libère immédiatement les places. Une confirmation n’est jamais possible après l’expiration d’une retenue.

La modification du titre, des horaires ou de la publication d’un atelier ayant des demandes actives est bloquée : traiter d’abord ces demandes et prévenir les participants. La liste de présence respecte les filtres sélectionnés ; filtrer sur les réservations confirmées avant impression.

Les actualités peuvent être enregistrées comme brouillons, publiées à une date donnée ou archivées. Photos JPEG, PNG et WebP, maximum 3 Mo. Le texte est affiché sans interprétation HTML.

## Emails : configuration requise

Dans **Équipe & emails**, le responsable renseigne une clé API Resend et une adresse sur un domaine expéditeur vérifié. La clé est chiffrée avec AES-GCM dans la base et n’est jamais renvoyée au navigateur. Aucun email réel n’est envoyé pendant les tests locaux.

Chaque demande et chaque décision produit un email dans une file persistante. Les échecs sont visibles dans l’administration ; **Relancer les envois** retente au plus 10 messages par clic. Un nouvel événement de réservation tente également l’envoi des messages de cette réservation. Il n’y a pas de tâche planifiée autonome : surveiller la file dans l’administration. Tant que l’expéditeur n’est pas configuré, l’écran public indique que la demande est enregistrée mais que l’email n’a pas été envoyé, et affiche son lien de suivi. L’équipe contacte alors les participants manuellement.

Le service d’envoi peut accepter un email qui sera ensuite rejeté par le serveur destinataire. Le suivi présenté correspond à l’acceptation par Resend, pas à une preuve de lecture ou de livraison.

## Technique

Vinext / React, Better Auth (email et mot de passe), Cloudflare D1 / SQLite, R2 pour les photos. Les API privées vérifient une session et les droits à chaque appel. Les nouvelles inscriptions sont accessibles seulement par les liens d’activation validés côté serveur. L’endpoint public de création de compte est bloqué. Les mutations vérifient l’origine et les limites de volume. Les liens de suivi utilisent un secret aléatoire de 256 bits, conservé uniquement sous forme de hash dans la table des réservations. Les liens sont passés dans le fragment URL, puis transmis dans le corps des requêtes, sans figurer dans les journaux d’URL.

Les données locales sont distinctes de la production. Les migrations Drizzle sont appliquées par Sites au déploiement. Ne pas modifier une migration déjà appliquée ; ajouter une nouvelle migration.

```powershell
npm install
# Configurer les valeurs locales en suivant .env.example ; ne jamais publier .env.local, .dev.vars ou work/.
npx wrangler d1 execute site-creator-d1 --local --config wrangler.local.json --file drizzle/0000_busy_strong_guy.sql
npm run dev
node --test tests/service.test.mjs
# Sur une base locale dédiée, avec les paramètres locaux de bootstrap :
node tests/http-smoke.mjs
npx tsc --noEmit
npm run build
```

Les valeurs de production sont gérées séparément dans Sites. `ADMIN_EMAIL` identifie le responsable initial. Le secret d’activation initial est remis séparément et n’est jamais versionné. Le site ne publie aucun atelier inventé : l’équipe doit créer et publier les prochaines dates.

Les fichiers de `source/` conservent la version publique d’origine. `scripts/prepare-public.mjs` permet de régénérer le HTML public et ses ressources ; les ajouts fonctionnels se trouvent dans `public/public-live.js` et `public/public-live.css`.
