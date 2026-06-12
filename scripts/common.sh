#!/usr/bin/env bash

COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${COMMON_DIR}/.." && pwd)"

setup_repo_env() {
  export PATH="$HOME/.cargo/bin:/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin:$PATH"
  export PATH="$HOME/Library/pnpm:$HOME/.local/share/pnpm:$PATH"
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1091
    source "$NVM_DIR/nvm.sh"
  fi

  ensure_min_node 18
  ensure_pnpm_shim
}

latest_nvm_node() {
  if ! command -v python3 >/dev/null 2>&1; then
    return
  fi

  python3 - "$NVM_DIR" <<'PY'
import pathlib
import sys

nvm_dir = pathlib.Path(sys.argv[1])
root = nvm_dir / "versions" / "node"
if not root.is_dir():
    raise SystemExit(0)

candidates = []
for node_path in root.glob("*/bin/node"):
    version_name = node_path.parent.parent.name
    if not version_name.startswith("v"):
        continue
    try:
        version_tuple = tuple(int(part) for part in version_name[1:].split("."))
    except ValueError:
        continue
    candidates.append((version_tuple, str(node_path)))

if candidates:
    print(max(candidates)[1])
PY
}

ensure_min_node() {
  local min_major="${1:-18}"
  local current_major="0"

  if command -v node >/dev/null 2>&1; then
    current_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  fi

  if [ "$current_major" -lt "$min_major" ] && [ -d "$NVM_DIR/versions/node" ]; then
    local candidate=""
    candidate="$(latest_nvm_node || true)"
    if [ -n "$candidate" ]; then
      export PATH="$(dirname "$candidate"):$PATH"
      current_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
    fi
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "[env] node is required but was not found in PATH." >&2
    exit 1
  fi

  if [ "$current_major" -lt "$min_major" ]; then
    echo "[env] node >= ${min_major} is required, found $(node --version)." >&2
    exit 1
  fi
}

ensure_pnpm_shim() {
  if command -v pnpm >/dev/null 2>&1; then
    return
  fi

  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
  fi
}

run_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
    return
  fi

  if command -v corepack >/dev/null 2>&1; then
    corepack pnpm "$@"
    return
  fi

  echo "[env] pnpm is required but was not found. Install Node.js with corepack or pnpm." >&2
  exit 1
}
