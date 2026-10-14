#!/usr/bin/env bash
# Run ONCE on the DEPLOYMENT server, from the project folder:
#   sudo bash scripts/setup-database.sh
# Safe to run again: it keeps the existing password and data.
set -euo pipefail

APP_ROOT=/opt/devops-app
DB_DIR="$APP_ROOT/database"
APP_ENV="$APP_ROOT/.env"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "Please run with sudo"; exit 1; }
command -v docker >/dev/null || { echo "Docker is not installed (run setup-deploy-server.sh first)"; exit 1; }
command -v openssl >/dev/null || apt-get install -y openssl

mkdir -p "$DB_DIR"
cp "$SRC_DIR/database/docker-compose.yml" "$DB_DIR/docker-compose.yml"

if [ -f "$DB_DIR/.env" ]; then
  echo "==> Database settings already exist, keeping the same password and port"
  # shellcheck disable=SC1091
  . "$DB_DIR/.env"
  PASS="$POSTGRES_PASSWORD"
  PORT="$DB_PORT"
else
  PORT=""
  USED_PORTS="$(ss -ltn | awk '{print $4}')"
  for p in 5432 5433 5434 5435; do
    if ! grep -q ":$p\$" <<< "$USED_PORTS"; then PORT=$p; break; fi
  done
  [ -n "$PORT" ] || { echo "No free port found between 5432 and 5435"; exit 1; }
  PASS="$(openssl rand -hex 16)"
  umask 077
  printf 'POSTGRES_PASSWORD=%s\nDB_PORT=%s\n' "$PASS" "$PORT" > "$DB_DIR/.env"
  echo "==> Created new database password (stored in $DB_DIR/.env)"
fi

echo "==> Starting PostgreSQL on 127.0.0.1:$PORT"
docker compose --project-directory "$DB_DIR" -f "$DB_DIR/docker-compose.yml" up -d

echo "==> Waiting for the database to accept connections"
ready=0
for _ in $(seq 1 30); do
  if docker exec farm-postgres pg_isready -U farm -d farmdb >/dev/null 2>&1; then ready=1; break; fi
  sleep 2
done
[ "$ready" -eq 1 ] || { echo "Database did not become ready. Check: sudo docker logs farm-postgres"; exit 1; }

echo "==> Writing the app's connection settings to $APP_ENV"
umask 077
printf 'DATABASE_URL=postgres://farm:%s@127.0.0.1:%s/farmdb\n' "$PASS" "$PORT" > "$APP_ENV"
if id deploy >/dev/null 2>&1; then chown deploy:deploy "$APP_ENV"; fi
chmod 600 "$APP_ENV"

echo
echo "Database is ready."
echo "  Settings the app uses : $APP_ENV (readable only by the deploy user)"
echo "  Look inside the DB    : sudo docker exec -it farm-postgres psql -U farm -d farmdb"
echo "Next: push the new code to GitHub and let Jenkins deploy it."
