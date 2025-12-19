#!/usr/bin/env bash

# If invoked with `sh scripts/fix.sh`, re-run under bash.
if [ -z "${BASH_VERSION:-}" ]; then
	exec bash "$0" "$@"
fi

set -euo pipefail

# Ensure cargo and other tools are in PATH (especially for Git hooks)
export PATH="$HOME/.cargo/bin:$PATH"

# Try to load nvm if it exists to get the correct node/pnpm version
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  source "$NVM_DIR/nvm.sh"
fi

# Add common pnpm and node paths
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin:$PATH"
# Add pnpm specific paths (macOS/Linux)
export PATH="$HOME/Library/pnpm:$HOME/.local/share/pnpm:$PATH"

# If pnpm is still not found, try to find it in the current nvm node version
if ! command -v pnpm >/dev/null 2>&1; then
  # Look for pnpm in any nvm version as a fallback
  PNPM_NVM_PATH=$(find "$NVM_DIR/versions/node" -name pnpm -type f -perm +111 -print -quit 2>/dev/null || true)
  if [ -n "$PNPM_NVM_PATH" ]; then
    export PATH="$(dirname "$PNPM_NVM_PATH"):$PATH"
  fi
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

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