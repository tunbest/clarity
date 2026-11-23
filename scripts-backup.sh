#!/bin/sh
set -eu
: "${BACKUP_DIR:=./backups}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP_DIR/clarity-${STAMP}.dump"
find "$BACKUP_DIR" -type f -name 'clarity-*.dump' -mtime +14 -delete
