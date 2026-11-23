#!/bin/sh
set -eu
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD must be set}"
psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$POSTGRES_APP_PASSWORD" <<'SQL'
CREATE ROLE clarity_app LOGIN PASSWORD :'app_password';
SELECT format('GRANT CONNECT ON DATABASE %I TO clarity_app', current_database()) \gexec
GRANT USAGE, CREATE ON SCHEMA public TO clarity_app;
ALTER ROLE clarity_app SET search_path = public;
SQL
