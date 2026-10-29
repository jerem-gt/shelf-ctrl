# CLAUDE.md

## Project Overview

**ShelfCtrl** gère une collection personnelle de BD, DVD et Blu-ray : inventaire, prêts, état et suivi des ventes. Usage perso (un seul compte admin), auto-hébergé sur un Synology DS723+, utilisé sur PC et sur Android (PWA).

- **Client** : React 19 + Vite, Tailwind CSS 4, TanStack Query, react-router v7+.
- **Server** : Node.js/TypeScript, Express 5, SQLite (`better-sqlite3`), Zod.
- **Shared** (`@shelfctrl/types`) : types et constantes partagés client/serveur.

Même stack et mêmes conventions que `cash-ctrl` (monorepo npm workspaces, CI GitHub Actions → ghcr.io → Watchtower).

## Development Commands

- `npm run dev` : serveur (`tsx watch`, port 3001) + client (Vite, port 5173, proxy `/api` et `/covers`).
- `npm run build`, `npm run lint`, `npm run format`.
- `npm run test` / `test:coverage` : Vitest (client et serveur).
- `npm run typecheck:test --workspace=client` : types des tests client (`tsconfig.json` exclut les `*.test.ts(x)`) ; `npm run typecheck --workspace=server` : types du serveur (tsup ne les vérifie pas).
- **Fichiers communs avec cash-ctrl** dans le dépôt [`jerem-gt/ctrl-shared`](https://github.com/jerem-gt/ctrl-shared) : workflow CI/Docker réutilisable (appelé par `.github/workflows/ci.yml`), `Dockerfile`, script `prepare-runtime-deps` (devDependency `@jerem-gt/ctrl-shared`, **même tag que le workflow**) et preset Renovate. Ne pas les recopier ici : un changement se fait dans `ctrl-shared`, puis un nouveau tag que Renovate propose de monter dans les deux projets. Propre à shelf-ctrl : `.github/smoke.env` (variables du conteneur) et `.github/smoke-test.sh` (login, `sharp`). L'image n'est construite que si une release est publiée (push sur `main` ou `develop` avec un commit `feat`/`fix`) ; les checks s'appellent `app / 🧪 CI & Tests`, etc.
- Hook pre-commit : Husky + lint-staged (ESLint + Prettier sur les fichiers stagés).

## Modèle de données

Titre → édition → exemplaire :

- `works` : l'œuvre (titre, série, numéro de tome).
- `editions` : une version d'une œuvre (format `book`/`dvd`/`bluray`/`uhd4k`, code-barres ISBN/EAN, éditeur, pochette).
- `copies` : **l'objet physique possédé** (état sur 5 niveaux, note, photo, emplacement).
- `borrowers`, `loans`, `sales` : mouvements d'un exemplaire.
- **Le statut d'un exemplaire (`owned`/`loaned`/`listed`/`sold`) n'est jamais stocké** : il dérive des mouvements via la vue `copy_status`. Ne jamais ajouter de colonne `status` sur `copies`.
- **Ventes** : au plus une ligne `sales` par exemplaire (index unique). La ligne seule vaut « en vente » (`listed_at`), `sold_at` renseigné vaut « vendu » (vente directe : `listed_at` nul). Retirer l'annonce ou annuler la vente supprime la ligne ; un exemplaire prêté ne peut pas être vendu. Prix en centimes.
- **Prêts** : un seul prêt en cours par exemplaire (index partiel) ; un exemplaire vendu ne peut plus être prêté. Dates au format AAAA-MM-JJ, par défaut le jour même.
- États, formats et statuts sont définis une seule fois dans `shared/src/index.ts` ; les `CHECK` SQL de `server/src/db/schema.ts` doivent rester alignés.

## TypeScript & Code Quality

- **Strict Mode** : jamais `any`, préférer `unknown`.
- **Path Aliases** : `@/*` pour les imports dans `src/`.
- Interdiction des variables/paramètres inutilisés et des fallthrough dans les switchs.
- **Target** : client ES2023 / serveur ES2025.
- **Ternaires imbriqués** (Sonar) : interdits ; extraire dans une variable `let` avec `if/else` ou une fonction nommée.
- **Conditions négatives** (Sonar) : mettre la branche positive en premier dans un `if/else`.

## Architecture

### Frontend

- État asynchrone : TanStack Query uniquement. Icônes : `lucide-react`.
- **Mobile-first** : toute interface doit être affichable sur mobile (breakpoints `md:`, `lg:`), pas de largeurs fixes.
- Le scan de code-barres utilise la caméra (`BarcodeDetector`, supporté par Chrome Android) ; HTTPS requis.

### i18n

Français uniquement pour l'instant, mais **tous les textes passent par `useTranslation`** (`client/src/locales/fr/`). Pour ajouter l'anglais : créer `locales/en/` en miroir exact des clés `fr/`.

### Backend

- **Documentation de l'API** (module `openapi`, comme cash-ctrl) : Swagger UI sur `/api/docs`, spec sur `/api/docs/openapi.json`, publique (aucune donnée). Spec écrite dans `server/src/openapi/spec.ts`, corps et paramètres générés depuis les schémas Zod des routes : toute route ajoutée ou modifiée s'y reporte.
- Séparer routes, services et validation (Zod). **Migrations SQLite par `user_version`** (`server/src/db/migrations.ts`) : `schema.ts` crée le schéma initial (idempotent), puis chaque migration de la liste s'applique dans l'ordre et incrémente la version ; ne jamais modifier une migration livrée, en ajouter une.
- Les images (pochettes, photos) sont stockées dans `DATA_DIR` et servies par le serveur, jamais liées à distance. Module `images` : tout est converti en WebP par `sharp` (réduit à 900 px pour les pochettes, 1600 px pour les photos, EXIF retiré) dans `DATA_DIR/images/{covers,photos}` ; le nom `<id>-<empreinte>.webp` rend le cache immuable (`/covers/*`, `/photos/*`, derrière la session). La pochette appartient à l'**édition** (`editions.cover_path`, partagée par ses exemplaires, supprimée avec la dernière), la photo à l'**exemplaire** (`copies.photo_path`). Envoi en corps brut (`PUT /api/editions/:id/cover`, `PUT /api/copies/:id/photo`, 12 Mo max). À l'ajout d'un exemplaire sans pochette, elle est cherchée en arrière-plan (Open Library par ISBN ; TMDB par titre et année si `TMDB_API_KEY`) ; `POST /api/editions/:id/cover/fetch` relance la recherche et remplace.
- **Annonces** : un simple **gabarit**, calculé côté client (`client/src/lib/listing.ts`, textes dans `locales/fr` sous `listing`), sans serveur ni IA. Titre ajusté à la limite de la plateforme (`lib/platforms.ts` : Vinted 60, Leboncoin 70, eBay 80, 80 par défaut) ; description faite des champs renseignés, sans prix suggéré (aucune donnée de marché fiable). L'annonce est **fusionnée avec la mise en vente** : le formulaire « Mettre en vente » (plateforme obligatoire) et celui de modification affichent l'annonce en direct pour la plateforme saisie ; une annonce déjà publiée se rouvre depuis la fiche. « Marquer comme vendu » garde la plateforme facultative (« vendu sur… »). Un LLM distant avait été essayé (Gemini/Groq/Mistral) puis retiré : gain marginal face à un gabarit, pannes et quotas des offres gratuites, dépendance et clé à gérer.
- **Import CSV** (module `import`, page `/import`) : fichier envoyé en corps brut (2 Mo, 1000 lignes max), décodé en UTF-8 puis Windows-1252, séparateur détecté (`;` `,` tabulation), colonnes reconnues par leur en-tête (FR/EN, accents et ordre indifférents : titre, série, tome, auteurs, format, code-barres, éditeur, année, langue, état, note, emplacement ; les autres sont ignorées). `GET /api/import/template` donne un modèle (BOM + `;`, pour Excel). `POST /api/import/preview` contrôle sans rien écrire ; `POST /api/import` lance une **tâche de fond en mémoire** (un seul import à la fois, 409 sinon ; perdue au redémarrage) suivie par `GET /api/import/:id`, car une complétion en ligne dépasse le délai du reverse proxy. Une ligne avec code-barres mais sans titre, auteurs ou éditeur (ou un EAN vidéo sans support) est **complétée en ligne** comme au scan : les valeurs du fichier priment, un code introuvable sans titre est une erreur de ligne. Format absent → livre si ISBN ou sans code, sinon fiche en ligne. Les doublons créent **un exemplaire de plus** (l'aperçu les signale). La pochette de chaque nouvelle édition est cherchée ensuite. Erreurs par ligne (codes, traduits côté client), sans bloquer les autres.
- **Réglages du compte** (module `platforms`, page `/settings`) : les plateformes de vente où l'on a un compte (table `platforms`, migration 1) et celle **par défaut** (au plus une, index unique ; la première ajoutée l'est d'office). Plateformes connues (Vinted, Leboncoin, eBay, Momox, Rakuten, Amazon : adresse de dépôt et limite de titre dans `client/src/lib/platforms.ts`, rien de figé en base) à cocher, ou **personnalisées** avec une adresse de dépôt facultative (http/https seulement : elle devient un lien). Le formulaire de mise en vente propose ces plateformes, la plateforme par défaut présélectionnée ; sans aucun réglage, toutes les plateformes connues sont proposées. Les ventes gardent le nom en clair : retirer une plateforme ne touche pas à l'historique, et celle d'une annonce existante reste proposée à la modification.
- **Authentification** (même principe que `cash-ctrl`) : `express-session` avec un store SQLite (`session-store.ts`), mot de passe haché en `bcrypt`, régénération de la session à la connexion, échecs limités par IP (`FailureRateLimiter`, persisté en base). Compte unique : `ADMIN_USER` / `ADMIN_PASSWORD` font foi et sont synchronisés dans `users` à chaque démarrage ; les modifier supprime les sessions ouvertes. Tout `/api` exige une session sauf `/api/health`, `/api/docs` et `/api/auth/*`. En production, le serveur **refuse de démarrer** si `SESSION_SECRET` (32 caractères minimum) ou `ADMIN_PASSWORD` (8 minimum) manque ou est vide : un compose dont la variable est absente la passe à vide. Le cookie s'appelle `shelfctrl.sid` (cookies et noms d'hôte sont partagés avec `cash-ctrl` sur le NAS) et est `Secure` derrière HTTPS (`SECURE_COOKIE=true` + `trust proxy`). Pas de 2FA ni de changement de mot de passe dans l'interface pour l'instant.
- Résolution des codes-barres (`GET /api/barcodes/:code`, module `barcodes`) : le code est normalisé (ISBN-10 → ISBN-13, UPC-A → EAN-13, clé de contrôle vérifiée), cherché d'abord dans la collection, puis dans une chaîne de sources par type de code, avec repli en saisie manuelle (404). ISBN : BnF (SRU, gratuit, série et tome des BD francophones ; cherche l'ISBN-13 et l'ISBN-10, les anciennes notices n'ont que le second), puis Google Books (si `GOOGLE_BOOKS_API_KEY`, le quota anonyme est nul), puis Open Library. EAN vidéo : UPCitemdb (gratuit, limité en débit), dont le titre est fiabilisé par TMDB si `TMDB_API_KEY` (TMDB ne cherche pas par code-barres). Une source en erreur est ignorée ; les codes sont stockés sous leur forme normalisée.
- Recherche par titre (`GET /api/titles/search?q=`, module `titles`, formulaire d'ajout) : sans code-barres, ou code inconnu. Sources interrogées en parallèle, une en erreur est ignorée, doublons de code-barres retirés, jamais de 404 (liste vide). Livres : BnF (SRU, textes imprimés) puis Open Library ; films : TMDB si `TMDB_API_KEY` (titre et année seulement, sans code-barres ni support). Le résultat choisi préremplit le formulaire, une valeur absente laisse la saisie en place.

## Testing

- Vitest partout. Client : `@testing-library/react` + jsdom ; appels API simulés avec MSW (`client/src/tests/msw`) ; serveur : sources externes simulées par un `fetch` injecté.
- Intitulés de tests : laisser Prettier gérer les quotes (`singleQuote: true`).

## Déploiement

Stack Portainer dédiée, qui lit `docker-compose.yml` tel quel sur la branche `develop` de GitHub, redéployée à la main (Watchtower ne met à jour que les images) : une variable ajoutée au compose se crée d'abord dans la stack Portainer, sinon elle arrive vide ; prod sur le port 3101, dev sur 4101 (identiques en interne et publiés, comme cash-ctrl ; 3001 et 4001 étaient déjà utilisés sur le NAS), données dans `/volume1/data/shelf-ctrl` et `/volume1/data/shelf-ctrl-dev`. Image `ghcr.io/jerem-gt/shelf-ctrl` construite par la CI, mise à jour automatiquement par Watchtower (scope `app-fast`). Image allégée : serveur entièrement bundlé par tsup (`server/tsup.config.ts`) hors modules natifs listés dans `server/runtime-externals.json` (better-sqlite3, bcrypt, sharp, swagger-ui-express), dont `prepare-runtime-deps` (`ctrl-shared`) extrait les seuls binaires linux/x64/musl dans `deploy/node_modules` (à lancer sur Alpine : npm n'installe que les `@img/sharp-*` de l'hôte) ; seul le fuseau Europe/Paris est embarqué ; la CI démarre l'image (santé, front, docs, puis `.github/smoke-test.sh`) avant le push. Un nouveau module natif s'ajoute à `runtime-externals.json` (et, s'il a des prebuilds par plateforme, leur filtrage au script de `ctrl-shared`). Variables : `SESSION_SECRET` (prod) et `SESSION_SECRET_DEV` (dev, distinct : les cookies ne sont pas isolés par port), `ADMIN_PASSWORD`, `PUID`, `PGID` ; facultatives (vides par défaut) : `GOOGLE_BOOKS_API_KEY`, `TMDB_API_KEY`.
