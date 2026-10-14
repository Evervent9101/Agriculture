#!/usr/bin/env bash
# Runs ON THE DEPLOYMENT SERVER. Jenkins copies the newest version here before every deploy.
# Called by Jenkins: deploy.sh <build_number> <app_version>
set -euo pipefail

BUILD="${1:?build number required}"
VERSION="${2:-1.0.$BUILD}"
APP_ROOT=/opt/devops-app
RELEASE_DIR="$APP_ROOT/releases/$BUILD"
ARCHIVE="/tmp/release-$BUILD.tar.gz"
ENV_FILE="$APP_ROOT/.env"

# The ecosystem file uses this path, so PM2 follows the "current" link to each new release
export APP_DIR="$APP_ROOT/current"

# True when every running backend process works inside the release that "current" points to.
backend_on_current_release() {
  local want pid dir seen=0
  want="$(readlink -f "$APP_ROOT/current/backend")"
  for pid in $(pm2 pid backend 2>/dev/null); do
    case "$pid" in ''|*[!0-9]*|0) continue ;; esac
    dir="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
    seen=1
    [ "$dir" = "$want" ] || return 1
  done
  [ "$seen" -eq 1 ]
}

# Starts or reloads the apps and makes sure they really run the release "current" points to.
start_apps() {
  cd "$APP_ROOT/current"
  pm2 startOrReload ecosystem.config.js --update-env
  if ! backend_on_current_release; then
    echo "==> PM2 is still using an older release folder, restarting the apps cleanly"
    pm2 delete backend frontend >/dev/null 2>&1 || true
    pm2 start ecosystem.config.js --update-env
  fi
  pm2 save
}

# The API must answer AND report that the database is reachable.
healthy() {
  local out
  out="$(curl -fsS http://127.0.0.1:3000/api/health 2>/dev/null || true)"
  grep -q '"db":"up"' <<< "$out"
}

echo "==> Checking database settings"
if [ ! -f "$ENV_FILE" ]; then
  echo "!! $ENV_FILE not found. Run 'sudo bash scripts/setup-database.sh' on this server first."
  exit 1
fi
# Load DATABASE_URL (and anything else in the file) for PM2
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

echo "==> Unpacking release $BUILD"
mkdir -p "$RELEASE_DIR"
tar -xzf "$ARCHIVE" -C "$RELEASE_DIR"

echo "==> Installing production dependencies"
( cd "$RELEASE_DIR/backend" && npm ci --omit=dev )

echo "==> Switching 'current' symlink"
PREV="$(readlink -f "$APP_ROOT/current" || true)"
ln -sfn "$RELEASE_DIR" "$APP_ROOT/current"

echo "==> Reloading PM2 apps"
export APP_VERSION="$VERSION" BUILD_NUMBER="$BUILD"
start_apps

echo "==> Health check (API and database)"
ok=0
for _ in $(seq 1 15); do
  if healthy; then ok=1; break; fi
  sleep 2
done

if [ "$ok" -ne 1 ]; then
  echo "!! Health check failed - rolling back"
  pm2 logs backend --lines 25 --nostream || true
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    ln -sfn "$PREV" "$APP_ROOT/current"
    start_apps || true
  fi
  exit 1
fi

echo "==> Cleaning up (keep last 5 releases)"
rm -f "$ARCHIVE"
cd "$APP_ROOT/releases" && ls -1dt */ | tail -n +6 | xargs -r rm -rf

echo "==> Deploy of build $BUILD complete (running from $(readlink -f "$APP_ROOT/current"))"
