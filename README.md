# 📚 ShelfCtrl

Gestion d'une collection personnelle de BD, DVD et Blu-ray : inventaire, prêts, état des exemplaires et suivi des ventes. Plusieurs comptes, chacun avec sa collection.

## Démarrage

```bash
npm install
cp server/.env.example server/.env
npm run dev
```

Client : http://localhost:5173 (proxy `/api` vers le serveur sur le port 3001).

## Comptes

Les comptes se gèrent dans l'application, pas par variables d'environnement.

- **Premier démarrage** : sans aucun compte, le serveur écrit un jeton dans ses logs (`setup token: …`, en Docker : `docker logs shelf-ctrl`). L'application le demande pour créer le premier compte, administrateur.
- **Administrateurs** : page Utilisateurs pour créer, modifier ou supprimer les comptes et tester l'envoi des e-mails.
- **Mot de passe oublié** : lien envoyé par e-mail si `SMTP_*` et `APP_URL` sont renseignés (voir `server/.env.example`), sinon écrit dans les logs du serveur.

## Feuille de route

**v1** — scan d'un code-barres, fiche récupérée par API, création d'un exemplaire avec son état, recherche et liste, prêts, statut de vente.

**v2** — annonces préparées par gabarit (titre et description à coller sur la plateforme), import CSV, tomes manquants d'une série.

## Stack

React 19 · Vite · Tailwind 4 · TanStack Query · Express 5 · SQLite · Docker (Portainer sur Synology).

Voir [CLAUDE.md](./CLAUDE.md) pour les conventions et le modèle de données.
