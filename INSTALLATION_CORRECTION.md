# Clarity PM – correctif PostgreSQL et déploiement

Cette version utilise une authentification par mot de passe gérée par le serveur et stockée dans PostgreSQL (aucun SSO Microsoft Entra ID requis).

## Pourquoi ce correctif

Les scripts `docker-entrypoint-initdb.d` ne sont exécutés que lors de la création initiale du volume PostgreSQL. Si `POSTGRES_APP_PASSWORD` change ensuite dans `.env`, le mot de passe du rôle `clarity_app` dans le volume reste inchangé. L'application reçoit alors le nouveau mot de passe et PostgreSQL refuse la connexion.

Le service `db-credentials-sync` corrige ce décalage à chaque exécution de ce service : il s'authentifie avec le compte administrateur PostgreSQL et applique `POSTGRES_APP_PASSWORD` au rôle `clarity_app`. Le serveur attend que ce service réussisse avant de démarrer.

## Déploiement

1. Sauvegarder le fichier `.env` et le volume PostgreSQL avant toute opération.
2. Décompresser cette archive dans un nouveau répertoire ou remplacer le code après sauvegarde.
3. Vérifier que `.env` contient les bons identifiants administrateur du volume existant. Ne pas remplacer aveuglément `POSTGRES_ADMIN_PASSWORD` par une nouvelle valeur : elle doit correspondre au mot de passe déjà enregistré dans PostgreSQL.
4. Valider la configuration puis construire et démarrer :

```bash
docker compose config --quiet
docker compose up -d --build
```

5. Contrôler les services :

```bash
docker compose ps
docker compose logs --tail=80 db-credentials-sync
docker compose logs --tail=100 app
curl -fsS http://127.0.0.1:${APP_PORT:-3000}/api/health
```

## Si `db-credentials-sync` échoue sur le mot de passe administrateur

Cela signifie que `POSTGRES_ADMIN_PASSWORD` ne correspond pas au compte administrateur stocké dans le volume. Ne supprimez pas le volume. Si l'accès local par socket fonctionne, ouvrez une session :

```bash
docker compose exec postgres psql -U "${POSTGRES_ADMIN_USER:-clarity_owner}" -d "$POSTGRES_DB"
```

Puis, dans psql, synchronisez le mot de passe administrateur avec la valeur `POSTGRES_ADMIN_PASSWORD` du `.env` :

```sql
\\password clarity_owner
\\q
```

Relancez ensuite le service de synchronisation et l'application :

```bash
docker compose rm -sf db-credentials-sync
docker compose up -d db-credentials-sync
docker compose up -d app
```

## Important

- Ne jamais exécuter `docker compose down -v` pour résoudre une erreur d'authentification.
- Ne jamais publier `.env` ni le committer dans Git. Le fichier est inclus dans cette archive à la demande, avec des permissions locales restreintes ; conservez-le confidentiel.
- `APP_BIND_ADDRESS=127.0.0.1` limite l'écoute à la machine. Utiliser un reverse proxy TLS sur le serveur pour l'accès externe.
- Le build Docker et les tests d'intégration sur le serveur cible doivent être exécutés avant de déclarer la version validée en production.
