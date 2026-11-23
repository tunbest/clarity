# Clarity PM

Application de pilotage de portefeuille et de projets : projets, MEP, Change/RITM, tâches, jalons, risques, Kanban, planning, rapports et comptes-rendus.

## Stack
- React + Vite
- API Express / Bun
- PostgreSQL 16
- Docker Compose

## Prérequis
- Docker Engine et Docker Compose sur le VPS
- Un fichier `.env` créé directement sur le VPS (ne jamais le committer)
- Le dépôt cloné sur le VPS dans le répertoire défini par le secret GitHub `VPS_APP_DIR`

## Déploiement automatique
Chaque push sur `main` lance `.github/workflows/deploy.yml`. Le runner se connecte au VPS en SSH, met à jour le dépôt et reconstruit le service applicatif.

Configurer les secrets GitHub suivants dans Settings > Secrets and variables > Actions :

| Secret | Description |
|---|---|
| `VPS_HOST` | Adresse IP ou nom DNS du VPS |
| `VPS_USER` | Utilisateur SSH de déploiement |
| `VPS_SSH_KEY` | Clé privée SSH dédiée au déploiement |
| `VPS_FINGERPRINT` | Empreinte SHA256 de la clé d'hôte SSH du VPS |
| `VPS_APP_DIR` | Chemin absolu du dépôt sur le VPS |

Le fichier `.env` doit déjà exister dans `VPS_APP_DIR` et contenir les variables requises par `docker-compose.yml`. Il n'est jamais transféré par GitHub Actions.

## Première installation VPS
1. Installer Docker Engine et le plugin Docker Compose.
2. Cloner ce dépôt dans le répertoire qui sera utilisé comme `VPS_APP_DIR`.
3. Créer et renseigner `.env` à partir de `.env.example` (mots de passe forts et uniques).
4. Vérifier `docker compose config`.
5. Lancer `docker compose up -d --build`.
6. Configurer le reverse proxy HTTPS vers `127.0.0.1:3000` si nécessaire.

## Sécurité
- Ne jamais committer `.env`, clés privées, dumps ou sauvegardes.
- Utiliser une clé SSH dédiée avec les permissions minimales nécessaires.
- La base PostgreSQL utilise un volume Docker persistant nommé `pgdata`.
- Aucune authentification Microsoft Entra ID n'est requise pour le mode d'authentification locale.
