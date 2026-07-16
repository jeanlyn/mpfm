#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
release_workflow="$repo_root/.github/workflows/release.yml"
workflow_readme="$repo_root/.github/workflows/README.md"
build_release="$repo_root/scripts/build-release.sh"
rename_fixed_webview2="$repo_root/scripts/rename-fixed-webview2-artifacts.ps1"
publish_fixed_webview2="$repo_root/scripts/publish-fixed-webview2-assets.ps1"

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

assert_not_line() {
  local file="$1"
  local line="$2"

  if grep -Fxq -- "$line" "$file"; then
    echo "Expected $file not to contain exact line:" >&2
    echo "$line" >&2
    exit 1
  fi
}

assert_contains "$release_workflow" "bundle_args: --target aarch64-apple-darwin --bundles dmg"
assert_contains "$release_workflow" "bundle_args: --target x86_64-apple-darwin --bundles dmg"
assert_not_contains "$release_workflow" "--bundles app"
assert_contains "$release_workflow" "asset_os: macos"
assert_contains "$release_workflow" "asset_os: linux"
assert_contains "$release_workflow" "asset_os: windows"
assert_contains "$release_workflow" "asset_arch: x86_64"
assert_contains "$release_workflow" "asset_arch: aarch64"
assert_contains "$release_workflow" 'assetNamePattern: mpfm-v[version]-desktop-${{ matrix.asset_os }}-${{ matrix.asset_arch }}[setup][ext]'
assert_not_contains "$release_workflow" 'releaseAssetNamePattern:'
assert_contains "$release_workflow" 'mpfm-v${VERSION}-cli-${{ matrix.asset_os }}-${{ matrix.asset_arch }}.tar.gz'
assert_contains "$release_workflow" 'mpfm-v$version-cli-${{ matrix.asset_os }}-${{ matrix.asset_arch }}.zip'
assert_contains "$release_workflow" 'path: dist/*.tar.gz'
assert_contains "$release_workflow" 'path: dist/*.zip'
assert_not_line "$release_workflow" "          path: dist/*"

assert_contains "$build_release" "--bundles dmg"
assert_not_contains "$build_release" "--bundles app"

assert_contains "$workflow_readme" "macOS Apple Silicon \`dmg\`"
assert_contains "$workflow_readme" "macOS Intel \`dmg\`"
assert_contains "$workflow_readme" "## FAQ"
assert_contains "$workflow_readme" "macOS 安装时报错"
assert_contains "$workflow_readme" "xattr -dr com.apple.quarantine"
assert_contains "$workflow_readme" 'mpfm-v{version}-{type}-{os}-{arch}'
assert_contains "$workflow_readme" 'mpfm-v0.3.1-desktop-macos-aarch64.dmg'
assert_contains "$workflow_readme" 'mpfm-v0.3.1-cli-windows-x86_64.zip'

assert_contains "$rename_fixed_webview2" '"x86_64-pc-windows-msvc" { "x86_64" }'
assert_contains "$rename_fixed_webview2" '"aarch64-pc-windows-msvc" { "aarch64" }'
assert_contains "$rename_fixed_webview2" '$assetBase = "mpfm-v$version-desktop-windows-$assetArch-fixed-webview2"'
assert_contains "$rename_fixed_webview2" '$newName = "$assetBase-$wixLanguage.msi"'
assert_contains "$rename_fixed_webview2" '$newName = "$assetBase-setup.exe"'
assert_contains "$publish_fixed_webview2" '$assetBase = "mpfm-v$version-desktop-windows-$assetArch-fixed-webview2"'
assert_contains "$publish_fixed_webview2" '"$bundleRoot/msi/$assetBase-*.msi"'
assert_contains "$publish_fixed_webview2" '"$bundleRoot/nsis/$assetBase-setup.exe"'

echo "[test-release-workflow] OK"
