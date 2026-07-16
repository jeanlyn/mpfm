#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
release_workflow="$repo_root/.github/workflows/release.yml"
ci_workflow="$repo_root/.github/workflows/ci.yml"
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

ruby - "$release_workflow" <<'RUBY'
require "yaml"

workflow = YAML.load_file(ARGV.fetch(0))
jobs = workflow.fetch("jobs")

desktop_rows = jobs.fetch("publish-desktop").fetch("strategy").fetch("matrix").fetch("include")
desktop_actual = desktop_rows.map do |row|
  row.values_at("name", "os", "asset_os", "asset_arch", "rust_target", "bundle_args")
end
desktop_expected = [
  ["macOS Apple Silicon", "macos-latest", "macos", "aarch64", "aarch64-apple-darwin", "--target aarch64-apple-darwin --bundles dmg"],
  ["macOS Intel", "macos-latest", "macos", "x86_64", "x86_64-apple-darwin", "--target x86_64-apple-darwin --bundles dmg"],
  ["Linux", "ubuntu-22.04", "linux", "x86_64", "", ""],
  ["Windows", "windows-2022", "windows", "x86_64", "", ""]
]
abort "Desktop release matrix does not match canonical OS/architecture mapping" unless desktop_actual == desktop_expected

desktop_step = jobs.fetch("publish-desktop").fetch("steps").find do |step|
  step["name"] == "Build and publish desktop bundle"
end
expected_pattern = 'mpfm-v[version]-desktop-${{ matrix.asset_os }}-${{ matrix.asset_arch }}[setup][ext]'
abort "Desktop release asset pattern is not canonical" unless desktop_step&.fetch("with", {})&.fetch("assetNamePattern", nil) == expected_pattern

cli_job = jobs.fetch("build-cli")
cli_rows = cli_job.fetch("strategy").fetch("matrix").fetch("include")
cli_actual = cli_rows.map do |row|
  row.values_at("target", "asset_os", "asset_arch", "archive", "binary_name")
end
cli_expected = [
  ["x86_64-unknown-linux-musl", "linux", "x86_64", "tar.gz", "main_cli"],
  ["aarch64-unknown-linux-musl", "linux", "aarch64", "tar.gz", "main_cli"],
  ["x86_64-apple-darwin", "macos", "x86_64", "tar.gz", "main_cli"],
  ["aarch64-apple-darwin", "macos", "aarch64", "tar.gz", "main_cli"],
  ["x86_64-pc-windows-msvc", "windows", "x86_64", "zip", "main_cli.exe"],
  ["aarch64-pc-windows-msvc", "windows", "aarch64", "zip", "main_cli.exe"]
]
abort "CLI release matrix does not match canonical OS/architecture mapping" unless cli_actual == cli_expected

unix_upload = cli_job.fetch("steps").find { |step| step["name"] == "Upload CLI artifact (Unix)" }
windows_upload = cli_job.fetch("steps").find { |step| step["name"] == "Upload CLI artifact (Windows)" }
abort "Unix CLI upload must only include tar.gz archives" unless unix_upload&.fetch("if", nil) == "runner.os != 'Windows'" && unix_upload.dig("with", "path") == "dist/*.tar.gz"
abort "Windows CLI upload must only include zip archives" unless windows_upload&.fetch("if", nil) == "runner.os == 'Windows'" && windows_upload.dig("with", "path") == "dist/*.zip"
RUBY

ruby - "$publish_fixed_webview2" <<'RUBY'
script = File.read(ARGV.fetch(0))
pattern_text = script[/\$Tag -match '([^']+)'/, 1]
abort "Could not find fixed WebView2 release tag pattern" unless pattern_text

pattern = Regexp.new(pattern_text)
valid_tags = [
  "v1.2.3",
  "v1.2.3-rc.1",
  "v1.2.3+build.4",
  "v1.2.3-rc.1+build.4"
]
invalid_tags = ["1.2.3", "v1.2", "v1.2.3_rc.1"]

valid_tags.each do |tag|
  abort "Expected release tag pattern to accept #{tag}" unless pattern.match?(tag)
end
invalid_tags.each do |tag|
  abort "Expected release tag pattern to reject #{tag}" if pattern.match?(tag)
end
RUBY

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
assert_contains "$workflow_readme" 'Tauri updater 元数据 `latest.json` 保留固定名称'

assert_contains "$rename_fixed_webview2" '"x86_64-pc-windows-msvc" { "x86_64" }'
assert_contains "$rename_fixed_webview2" '"aarch64-pc-windows-msvc" { "aarch64" }'
assert_contains "$rename_fixed_webview2" '$assetBase = "mpfm-v$version-desktop-windows-$assetArch-fixed-webview2"'
assert_contains "$rename_fixed_webview2" '$newName = "$assetBase-$wixLanguage.msi"'
assert_contains "$rename_fixed_webview2" '$newName = "$assetBase-setup.exe"'
assert_contains "$publish_fixed_webview2" '$assetBase = "mpfm-v$version-desktop-windows-$assetArch-fixed-webview2"'
assert_contains "$publish_fixed_webview2" '"$bundleRoot/msi/$assetBase-*.msi"'
assert_contains "$publish_fixed_webview2" '"$bundleRoot/nsis/$assetBase-setup.exe"'
assert_contains "$ci_workflow" "windows-release-script-tests:"
assert_contains "$ci_workflow" "run: ./scripts/test-fixed-webview2-assets.ps1"

echo "[test-release-workflow] OK"
