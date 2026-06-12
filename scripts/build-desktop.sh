#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

setup_repo_env
cd "$REPO_ROOT"

if [ "${1:-}" = "--" ]; then
  shift
fi

echo "[build-desktop] tauri build"
run_pnpm exec tauri build "$@"
