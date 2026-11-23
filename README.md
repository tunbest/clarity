# Clarity PM

Application de pilotage de portefeuille et de projets : projets, MEP, Change/RITM, tâches, jalons, risques, Kanban, planning, rapports et comptes-rendus.

## Stack
- React 19 + TypeScript + Vite
- API Express 4 compilée avec esbuild
- Bun 1.2.10
- PostgreSQL 16
- Docker Compose

## Développement et validation

```bash
bun install --frozen-lockfile
bun run typecheck
bun run build
```

La commande `bun run build` génère à la fois l'interface `dist/index.html` et le serveur `dist/server.cjs`. Le serveur de production est lancé par `bun run dist/server.cjs`.

## Déploiement VPS

- Docker Engine et Docker Compose v2 sur le VPS
- Créer `.env` sur le VPS à partir de `.env.example` avec des secrets uniques
- Cloner le dépôt dans le chemin du secret GitHub `VPS_APP_DIR`
- Configurer les secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_FINGERPRINT` et `VPS_APP_DIR`
- Configurer un reverse proxy HTTPS vers `127.0.0.1:3000`

Le workflow `.github/workflows/deploy.yml` déploie la branche `main`. Le workflow `.github/workflows/ci.yml` vérifie le typage et la compilation.

## Sécurité

- Authentification serveur par mot de passe, session opaque en cookie HttpOnly/SameSite, sans Microsoft Entra ID
- Ne jamais committer `.env`, clés privées, dumps ou sauvegardes
- PostgreSQL reste sur le réseau Docker interne
- Le volume `pgdata` conserve les données entre les redémarrages
- PostgreSQL est la source de vérité : portefeuille projets, tâches, jalons, risques, utilisateurs, paramètres et MEP
- Chaque MEP référence obligatoirement un `projectId` d'un projet Clarity existant ; tâches MEP, Change/RITM, participants et comptes-rendus sont enregistrés dans le même agrégat MEP côté serveur
- Le navigateur ne conserve aucune donnée métier ni session : l'authentification repose sur un cookie HttpOnly et les écrans chargent/sauvegardent via l'API
- Utiliser des mots de passe uniques et renouveler les identifiants précédemment exposés

## Modèle de données

Le mode navigateur autonome est retiré. Clarity nécessite le serveur Express et PostgreSQL pour fonctionner. Les exports JSON/CSV sont des fichiers de sauvegarde explicites ; ils ne constituent pas un stockage applicatif.
