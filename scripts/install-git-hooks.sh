#!/usr/bin/env bash

# If invoked with `sh scripts/install-git-hooks.sh`, re-run under bash.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

hooks_dir="$repo_root/.git/hooks"

if [[ ! -d "$hooks_dir" ]]; then
  echo "[hooks] .git/hooks not found. Are you in a git repo?" >&2
  exit 1
fi

cat > "$hooks_dir/pre-push" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

"$repo_root/scripts/check.sh"
EOF

chmod +x "$hooks_dir/pre-push"

echo "[hooks] Installed pre-push hook -> scripts/check.sh"