#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

assert_contains() {
  local haystack="$1"
  local needle="$2"

  if [[ "$haystack" != *"$needle"* ]]; then
    echo "Expected release notes to contain:" >&2
    echo "$needle" >&2
    echo >&2
    echo "Actual release notes:" >&2
    echo "$haystack" >&2
    exit 1
  fi
}

commit_with_subject() {
  local subject="$1"
  printf '%s\n' "$subject" >> changes.txt
  git add changes.txt
  git commit -q -m "$subject"
}

cd "$tmp_dir"
git init -q
git config user.email "release-notes@example.com"
git config user.name "Release Notes Test"

commit_with_subject "feat: initial release"
git tag v0.1.0

commit_with_subject "feat(ui): add tabbed file manager"
commit_with_subject "fix: handle file names with spaces"
commit_with_subject "docs(readme): document release process"
commit_with_subject "perf: speed up remote listings"
commit_with_subject "refactor(core)!: simplify protocol traits"
commit_with_subject "update bundled assets"
git tag v0.2.0

notes="$(bash "$repo_root/scripts/release-notes.sh" --tag v0.2.0 --repo-url https://github.com/example/mpfm)"

assert_contains "$notes" "## Changes since v0.1.0"
assert_contains "$notes" "Compare: https://github.com/example/mpfm/compare/v0.1.0...v0.2.0"
assert_contains "$notes" "### Features"
assert_contains "$notes" "- ui: add tabbed file manager ("
assert_contains "$notes" "### Fixes"
assert_contains "$notes" "- handle file names with spaces ("
assert_contains "$notes" "### Documentation"
assert_contains "$notes" "- readme: document release process ("
assert_contains "$notes" "### Performance"
assert_contains "$notes" "- speed up remote listings ("
assert_contains "$notes" "### Refactoring"
assert_contains "$notes" "- **BREAKING** core: simplify protocol traits ("
assert_contains "$notes" "### Other Changes"
assert_contains "$notes" "- update bundled assets ("
assert_contains "$notes" "## FAQ"
assert_contains "$notes" "### What should I do if macOS blocks the app during installation?"
assert_contains "$notes" "xattr -dr com.apple.quarantine /Applications/mpfm.app"
assert_contains "$notes" "### Will future release notes be updated automatically?"

echo "[test-release-notes] OK"
