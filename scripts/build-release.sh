#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${script_dir}/common.sh"

setup_repo_env
cd "$REPO_ROOT"

echo "[build-release] bootstrap dependencies"
bash "${script_dir}/bootstrap.sh"

echo "[build-release] verify version metadata"
bash "${script_dir}/release-version.sh" >/dev/null

echo "[build-release] run checks"
bash "${script_dir}/check.sh"

echo "[build-release] run cargo tests"
cargo test --verbose

echo "[build-release] build CLI"
bash "${script_dir}/build-cli.sh"

echo "[build-release] build desktop bundle"
if [ "$(uname -s)" = "Darwin" ]; then
  echo "[build-release] macOS detected, building app bundle to avoid Finder-only DMG packaging in headless environments"
  bash "${script_dir}/build-desktop.sh" --bundles app
else
  bash "${script_dir}/build-desktop.sh"
fi

echo "[build-release] done"
