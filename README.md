# 📚 ShelfCtrl

Gestion d'une collection personnelle de BD, DVD et Blu-ray : inventaire, prêts, état des exemplaires et suivi des ventes.

## Démarrage

```bash
npm install
cp server/.env.example server/.env
npm run dev
```

Client : http://localhost:5173 (proxy `/api` vers le serveur sur le port 3001).

## Feuille de route

**v1** — scan d'un code-barres, fiche récupérée par API, création d'un exemplaire avec son état, recherche et liste, prêts, statut de vente.

**v2** — annonces préparées par gabarit (titre et description à coller sur la plateforme), import CSV, tomes manquants d'une série.

## Stack

React 19 · Vite · Tailwind 4 · TanStack Query · Express 5 · SQLite · Docker (Synology Container Manager).

Voir [CLAUDE.md](./CLAUDE.md) pour les conventions et le modèle de données.
