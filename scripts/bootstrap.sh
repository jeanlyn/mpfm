#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

setup_repo_env
cd "$REPO_ROOT"

echo "[bootstrap] install root dependencies"
CI=true run_pnpm install --frozen-lockfile

echo "[bootstrap] install ui dependencies"
CI=true run_pnpm --dir ui install --frozen-lockfile

echo "[bootstrap] done"
