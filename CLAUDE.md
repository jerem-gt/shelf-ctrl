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
- Résolution des codes-barres : chaîne de sources avec repli de saisie manuelle (ISBN → Google Books/OpenLibrary ; EAN vidéo → API de code-barres puis TMDB par titre).

## Testing

- Vitest partout. Client : `@testing-library/react` + jsdom ; MSW à introduire avec le premier appel API.
- Intitulés de tests : laisser Prettier gérer les quotes (`singleQuote: true`).

## Déploiement

Stack Container Manager dédiée (`docker-compose.yml`) : prod sur le port 3001, dev sur 4001, données dans `/volume1/data/shelf-ctrl` et `/volume1/data/shelf-ctrl-dev`. Image `ghcr.io/jerem-gt/shelf-ctrl` construite par la CI, mise à jour automatiquement par Watchtower (scope `app-fast`). Variables : `SESSION_SECRET`, `ADMIN_PASSWORD`, `PUID`, `PGID`.
