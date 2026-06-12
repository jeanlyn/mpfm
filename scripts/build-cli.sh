#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

setup_repo_env
cd "$REPO_ROOT"

echo "[build-cli] cargo build --release --bin main_cli"
cargo build --release --bin main_cli --no-default-features --features cli "$@"
