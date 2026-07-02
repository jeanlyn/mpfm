#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
release_workflow="$repo_root/.github/workflows/release.yml"
workflow_readme="$repo_root/.github/workflows/README.md"
build_release="$repo_root/scripts/build-release.sh"

assert_contains() {
  local file="$1"
  local needle="$2"

  if ! grep -Fq -- "$needle" "$file"; then
    echo "Expected $file to contain:" >&2
    echo "$needle" >&2
    exit 1
  fi
}

assert_not_contains() {
  local file="$1"
  local needle="$2"

  if grep -Fq -- "$needle" "$file"; then
    echo "Expected $file not to contain:" >&2
    echo "$needle" >&2
    exit 1
  fi
}

assert_contains "$release_workflow" "bundle_args: --target aarch64-apple-darwin --bundles dmg"
assert_contains "$release_workflow" "bundle_args: --target x86_64-apple-darwin --bundles dmg"
assert_not_contains "$release_workflow" "--bundles app"

assert_contains "$build_release" "--bundles dmg"
assert_not_contains "$build_release" "--bundles app"

assert_contains "$workflow_readme" "macOS Apple Silicon \`dmg\`"
assert_contains "$workflow_readme" "macOS Intel \`dmg\`"
assert_contains "$workflow_readme" "## FAQ"
assert_contains "$workflow_readme" "macOS 安装时报错"
assert_contains "$workflow_readme" "xattr -dr com.apple.quarantine"

echo "[test-release-workflow] OK"
