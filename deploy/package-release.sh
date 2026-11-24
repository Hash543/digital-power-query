#!/usr/bin/env bash
# Package the standalone Next.js build into a release tarball.
# Run after `npm run build`. Usage: deploy/package-release.sh <output.tar.gz>
set -euo pipefail

out="${1:-app.tar.gz}"
root="$(cd "$(dirname "$0")/.." && pwd)"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

[ -f "$root/.next/standalone/server.js" ] || { echo "No standalone build found; run npm run build first" >&2; exit 1; }

# server.js + traced node_modules
cp -a "$root/.next/standalone/." "$stage/"
# The standalone server does not include static assets; copy them next to it.
mkdir -p "$stage/.next"
cp -a "$root/.next/static" "$stage/.next/static"
[ -d "$root/public" ] && cp -a "$root/public" "$stage/public"
# Never ship local env files.
rm -f "$stage"/.env*

tar -czf "$out" -C "$stage" .
echo "Packaged $(du -h "$out" | cut -f1) → $out"
