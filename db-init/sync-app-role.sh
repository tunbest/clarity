#!/bin/sh
set -eu

: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:?POSTGRES_DB must be set}"
: "${POSTGRES_ADMIN_USER:?POSTGRES_ADMIN_USER must be set}"
: "${POSTGRES_ADMIN_PASSWORD:?POSTGRES_ADMIN_PASSWORD must be set}"
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD must be set}"

export PGPASSWORD="$POSTGRES_ADMIN_PASSWORD"

# Wait for PostgreSQL to accept TCP connections.
attempt=0
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "ERROR: PostgreSQL is not reachable after 60 seconds." >&2
    exit 1
  fi
  sleep 2
done

# Idempotent: creates the role if missing and resets its password to the
# value from the current .env. No database or volume is dropped or recreated.
psql \
  --host="$POSTGRES_HOST" \
  --port="$POSTGRES_PORT" \
  --username="$POSTGRES_ADMIN_USER" \
  --dbname="$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --set=app_password="$POSTGRES_APP_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE clarity_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'clarity_app')
\gexec
ALTER ROLE clarity_app WITH LOGIN PASSWORD :'app_password';
SELECT format('GRANT CONNECT ON DATABASE %I TO clarity_app', current_database())\gexec
GRANT USAGE, CREATE ON SCHEMA public TO clarity_app;
ALTER ROLE clarity_app SET search_path = public;
SQL

echo "Database application role synchronised successfully."

