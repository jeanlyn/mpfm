#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

usage() {
  cat <<'EOF' >&2
Usage: scripts/release.sh [--dry-run] <version>

Examples:
  pnpm run release -- 0.2.4
  pnpm run release -- --dry-run 0.2.4
EOF
  exit 1
}

DRY_RUN=0
TARGET_VERSION=""

if [ "${1:-}" = "--" ]; then
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage
      ;;
    *)
      if [ -n "$TARGET_VERSION" ]; then
        usage
      fi
      TARGET_VERSION="$1"
      shift
      ;;
  esac
done

if [ -z "$TARGET_VERSION" ]; then
  usage
fi

TARGET_VERSION="${TARGET_VERSION#v}"
RELEASE_TAG="v${TARGET_VERSION}"
RELEASE_FILES=(
  "Cargo.toml"
  "package.json"
  "ui/package.json"
  "tauri.conf.json"
  "tauri.win.conf.json"
)

restore_release_files() {
  if [ "$DRY_RUN" -eq 1 ]; then
    git restore --source=HEAD --staged --worktree -- "${RELEASE_FILES[@]}" >/dev/null 2>&1 || true
  fi
}

trap restore_release_files EXIT

setup_repo_env
cd "$REPO_ROOT"

current_branch="$(git branch --show-current)"
if [ "$current_branch" != "master" ]; then
  echo "[release] releases must be created from master, current branch: $current_branch" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "[release] working tree must be clean before running a release." >&2
  exit 1
fi

echo "[release] fetch latest remote refs"
git fetch origin master --tags

read -r ahead behind < <(git rev-list --left-right --count HEAD...origin/master)
if [ "$behind" -ne 0 ]; then
  echo "[release] local master is behind origin/master. Pull or rebase before releasing." >&2
  exit 1
fi

if git rev-parse -q --verify "refs/tags/${RELEASE_TAG}" >/dev/null; then
  echo "[release] local tag ${RELEASE_TAG} already exists." >&2
  exit 1
fi

if git ls-remote --tags origin "refs/tags/${RELEASE_TAG}" | grep -q .; then
  echo "[release] remote tag ${RELEASE_TAG} already exists." >&2
  exit 1
fi

echo "[release] set version to ${TARGET_VERSION}"
bash "$SCRIPT_DIR/set-version.sh" "$TARGET_VERSION" >/dev/null

echo "[release] verify version metadata"
bash "$SCRIPT_DIR/release-version.sh" --expect-tag "$RELEASE_TAG" >/dev/null

echo "[release] run release build"
bash "$SCRIPT_DIR/build-release.sh"

echo "[release] stage release metadata"
git add "${RELEASE_FILES[@]}"

if [ "$DRY_RUN" -eq 1 ]; then
  if git diff --cached --quiet; then
    echo "[release] dry run: version already matches ${TARGET_VERSION}; no commit would be created."
  else
    echo "[release] dry run: would create commit 'chore: release ${TARGET_VERSION}'."
  fi
  echo "[release] dry run: would push origin master"
  echo "[release] dry run: would create and push tag ${RELEASE_TAG}"
  exit 0
fi

if git diff --cached --quiet; then
  echo "[release] version files already matched ${TARGET_VERSION}; skipping release commit."
else
  echo "[release] commit release metadata"
  git commit -m "chore: release ${TARGET_VERSION}"
fi

echo "[release] push master"
git push origin master

echo "[release] create tag ${RELEASE_TAG}"
git tag -a "${RELEASE_TAG}" -m "Release ${RELEASE_TAG}"

echo "[release] push tag ${RELEASE_TAG}"
git push origin "${RELEASE_TAG}"

echo "[release] release tag ${RELEASE_TAG} pushed successfully"
