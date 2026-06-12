#!/usr/bin/env bash

# If invoked with `sh scripts/fix.sh`, re-run under bash.
if [ -z "${BASH_VERSION:-}" ]; then
	exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

setup_repo_env

cd "$REPO_ROOT"

echo "[fix] rustfmt"
cargo fmt --all

echo "[fix] clippy auto-fix (best effort)"
if cargo clippy --help 2>/dev/null | grep -q -- '--fix'; then
	# Applies machine-applicable clippy suggestions.
	# Note: some clippy warnings can't be auto-fixed and must be handled manually.
	cargo clippy --fix --allow-dirty --allow-staged --all-targets --all-features
else
	echo "[fix] cargo clippy --fix not supported on this toolchain; skip auto-fix"
fi

echo "[fix] clippy strict check (-D warnings)"
cargo clippy --all-targets --all-features -- -D warnings

echo "[fix] done"
