#!/usr/bin/env bash

# If invoked with `sh scripts/check.sh`, re-run under bash.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

setup_repo_env

cd "$REPO_ROOT"

echo "[check] rustfmt (check only)"
cargo fmt --all -- --check

echo "[check] clippy (-D warnings)"
cargo clippy --all-targets --all-features -- -D warnings

echo "[check] frontend type-check"
run_pnpm --dir ui run type-check

echo "[check] frontend build"
run_pnpm --dir ui run build

echo "[check] release notes"
bash "$SCRIPT_DIR/test-release-notes.sh"

echo "[check] release workflow"
bash "$SCRIPT_DIR/test-release-workflow.sh"

echo "[check] OK"
