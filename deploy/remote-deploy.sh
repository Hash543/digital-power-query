#!/usr/bin/env bash
# Runs on the VPS. Unpacks a release, switches the `current` symlink, restarts the
# service, checks /api/health, and rolls back automatically if the check fails.
#
# Usage: remote-deploy.sh <commit-sha>
# Expects the tarball at $APP_DIR/incoming/app-<sha>.tar.gz
set -euo pipefail
trap 'echo "!! remote-deploy.sh failed at line $LINENO: $BASH_COMMAND" >&2' ERR

SHA="${1:?usage: remote-deploy.sh <commit-sha>}"
APP_DIR="${APP_DIR:-/opt/digital-power-query}"
SERVICE="${SERVICE:-digital-power-query}"
KEEP="${KEEP:-5}"
DEFAULT_PORT=18629

# The port is configured in one place on the VPS: PORT in shared/.env if present,
# otherwise Environment=PORT in the systemd unit. An explicit PORT env var wins.
detect_port() {
  local p=""
  [ -f "$APP_DIR/shared/.env" ] && p="$(grep -E '^PORT=' "$APP_DIR/shared/.env" | tail -1 | cut -d= -f2 | tr -d '"'"'"' \r')"
  [ -z "$p" ] && p="$(systemctl show -p Environment --value "$SERVICE" 2>/dev/null | tr ' ' '\n' | grep -E '^PORT=' | tail -1 | cut -d= -f2)"
  echo "${p:-$DEFAULT_PORT}"
}
PORT="${PORT:-$(detect_port)}"
echo "==> Health check port: $PORT"

TARBALL="$APP_DIR/incoming/app-$SHA.tar.gz"
RELEASE="$APP_DIR/releases/$(date -u +%Y%m%d%H%M%S)-${SHA:0:7}"

[ -f "$TARBALL" ] || { echo "Missing $TARBALL" >&2; exit 1; }

echo "==> Unpacking into $RELEASE"
mkdir -p "$RELEASE"
tar -xzf "$TARBALL" -C "$RELEASE"

# Only a `current` that resolves to an existing release counts as the previous release.
# A missing, dangling or looping symlink (left by an earlier failed deploy) does not.
PREVIOUS="$(readlink -f "$APP_DIR/current" 2>/dev/null || true)"
case "$PREVIOUS" in
  "$APP_DIR"/releases/?*) [ -d "$PREVIOUS" ] || PREVIOUS="" ;;
  *) PREVIOUS="" ;;
esac

switch_to() {
  ln -sfn "$1" "$APP_DIR/current.tmp"
  mv -Tf "$APP_DIR/current.tmp" "$APP_DIR/current"
  sudo -n systemctl restart "$SERVICE"
}

# A unit that is missing or a restart that fails must still roll back, so this runs with
# set -e suspended (it is called from an `if`).
deploy_ok() {
  switch_to "$1" || return 1
  healthy
}

healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$PORT/api/health" 2>/dev/null | grep -q "\"commit\":\"$SHA\""; then
      return 0
    fi
    sleep 1
  done
  return 1
}

echo "==> Switching current → $RELEASE and restarting $SERVICE"
if deploy_ok "$RELEASE"; then
  echo "==> Healthy: serving $SHA"
else
  echo "!! Deploy failed for $SHA (restart or health check)" >&2
  sudo -n systemctl status "$SERVICE" --no-pager -l | tail -20 >&2 || true
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    echo "!! Rolling back to $PREVIOUS" >&2
    switch_to "$PREVIOUS" || echo "!! Restart after rollback failed too" >&2
  else
    echo "!! No previous release to roll back to" >&2
    rm -f "$APP_DIR/current"
  fi
  rm -rf "$RELEASE" "$TARBALL"
  exit 1
fi

echo "==> Cleaning up (keeping $KEEP releases)"
rm -f "$TARBALL"
ls -1dt "$APP_DIR"/releases/*/ | tail -n +"$((KEEP + 1))" | xargs -r rm -rf
