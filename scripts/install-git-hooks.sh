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

# Optimization: Only run checks if code-related files have changed
# We read from stdin which provides: <local ref> <local sha> <remote ref> <remote sha>
while read -r local_ref local_sha remote_ref remote_sha; do
  if [ "$remote_sha" = "0000000000000000000000000000000000000000" ]; then
    # New branch: check all files in the current commit
    range="$local_sha"
  else
    # Existing branch: check diff between remote and local
    range="$remote_sha..$local_sha"
  fi

  # Define patterns that trigger a check (Rust, UI, Configs, Scripts)
  if git diff --name-only "$range" | grep -qE '\.(rs|toml|json|ts|tsx|css|html|sh)$|^ui/|^src/|^scripts/'; then
    echo "[hooks] Code changes detected in $range, running checks..."
    "$repo_root/scripts/check.sh"
    exit $?
  fi
done

echo "[hooks] No code changes detected, skipping checks."
EOF

chmod +x "$hooks_dir/pre-push"

echo "[hooks] Installed pre-push hook -> scripts/check.sh"