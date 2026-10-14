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
- `npm run typecheck:test --workspace=client` : types des tests client (`tsconfig.json` exclut les `*.test.ts(x)`).
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
- **Target** : client ES2023 / serveur ES2024.
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

- Séparer routes, services et validation (Zod). Migrations SQLite par `user_version` (à introduire à la première évolution de schéma).
- Les images (pochettes, photos) sont stockées dans `DATA_DIR` et servies par le serveur, jamais liées à distance.
- Les annonces générées passent par une **interface fournisseur LLM** (API distantes uniquement : Groq ou Mistral en gratuit par défaut ; pas de modèle local, le NAS est trop peu puissant).
- **Authentification** (même principe que `cash-ctrl`) : `express-session` avec un store SQLite (`session-store.ts`), mot de passe haché en `bcrypt`, régénération de la session à la connexion, échecs limités par IP (`FailureRateLimiter`, persisté en base). Compte unique : `ADMIN_USER` / `ADMIN_PASSWORD` font foi et sont synchronisés dans `users` à chaque démarrage ; les modifier supprime les sessions ouvertes. Tout `/api` exige une session sauf `/api/health` et `/api/auth/*`. En production, le serveur **refuse de démarrer** si `SESSION_SECRET` (32 caractères minimum) ou `ADMIN_PASSWORD` (8 minimum) manque ou est vide : un compose dont la variable est absente la passe à vide. Le cookie s'appelle `shelfctrl.sid` (cookies et noms d'hôte sont partagés avec `cash-ctrl` sur le NAS) et est `Secure` derrière HTTPS (`SECURE_COOKIE=true` + `trust proxy`). Pas de 2FA ni de changement de mot de passe dans l'interface pour l'instant.
- Résolution des codes-barres (`GET /api/barcodes/:code`, module `barcodes`) : le code est normalisé (ISBN-10 → ISBN-13, UPC-A → EAN-13, clé de contrôle vérifiée), cherché d'abord dans la collection, puis dans une chaîne de sources par type de code, avec repli en saisie manuelle (404). ISBN : BnF (SRU, gratuit, série et tome des BD francophones ; cherche l'ISBN-13 et l'ISBN-10, les anciennes notices n'ont que le second), puis Google Books (si `GOOGLE_BOOKS_API_KEY`, le quota anonyme est nul), puis Open Library. EAN vidéo : UPCitemdb (gratuit, limité en débit), dont le titre est fiabilisé par TMDB si `TMDB_API_KEY` (TMDB ne cherche pas par code-barres). Une source en erreur est ignorée ; les codes sont stockés sous leur forme normalisée.

## Testing

- Vitest partout. Client : `@testing-library/react` + jsdom ; appels API simulés avec MSW (`client/src/tests/msw`) ; serveur : sources externes simulées par un `fetch` injecté.
- Intitulés de tests : laisser Prettier gérer les quotes (`singleQuote: true`).

## Déploiement

Stack Container Manager dédiée (`docker-compose.yml`) : prod sur le port 3101, dev sur 4101 (identiques en interne et publiés, comme cash-ctrl ; 3001 et 4001 étaient déjà utilisés sur le NAS), données dans `/volume1/data/shelf-ctrl` et `/volume1/data/shelf-ctrl-dev`. Image `ghcr.io/jerem-gt/shelf-ctrl` construite par la CI, mise à jour automatiquement par Watchtower (scope `app-fast`). Variables : `SESSION_SECRET`, `ADMIN_PASSWORD`, `PUID`, `PGID`.
