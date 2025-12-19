#!/usr/bin/env bash

# If invoked with `sh scripts/check.sh`, re-run under bash.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$repo_root"

echo "[check] rustfmt (check only)"
cargo fmt --all -- --check

echo "[check] clippy (-D warnings)"
cargo clippy --all-targets --all-features -- -D warnings

echo "[check] frontend type-check"
if command -v pnpm >/dev/null 2>&1; then
  (cd ui && pnpm run type-check)
else
  echo "[check] pnpm not found. Install pnpm first (e.g. npm i -g pnpm)." >&2
  exit 1
fi

echo "[check] frontend build"
(cd ui && pnpm run build)

echo "[check] OK"