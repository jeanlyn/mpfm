# Release Asset Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every future GitHub Release asset a canonical filename that identifies mpfm, version, artifact type, operating system, and CPU architecture.

**Architecture:** Keep the existing build matrix and release jobs. Use `tauri-action`'s upload-only naming pattern for standard desktop bundles, explicit matrix labels for CLI archive names, and the existing PowerShell post-build step for fixed WebView2 installers.

**Tech Stack:** GitHub Actions YAML, Bash, PowerShell, Tauri Action v0, the repository's shell-based workflow checks.

## Global Constraints

- Release assets use `mpfm-v{version}-{type}-{os}-{arch}[-{variant}].{extension}`.
- `type` is exactly `desktop` or `cli`.
- `os` is exactly `macos`, `linux`, or `windows`.
- `arch` is exactly `x86_64` or `aarch64`.
- Only GitHub Release filenames change; Tauri `productName`, `mainBinaryName`, identifier, installer metadata, and installed application name remain unchanged.
- CLI archives keep `main_cli` or `main_cli.exe` as the executable name inside the archive.
- Existing v0.3.0 assets remain untouched.

---

### Task 1: Canonical standard desktop and CLI asset names

**Files:**
- Modify: `scripts/test-release-workflow.sh`
- Modify: `.github/workflows/release.yml`
- Modify: `.github/workflows/README.md`

**Interfaces:**
- Consumes: the existing desktop and CLI matrix entries and `needs.check-version.outputs.version`.
- Produces: canonical standard desktop upload names and one canonical CLI archive per target.

- [ ] **Step 1: Write the failing workflow assertions**

Add these assertions to `scripts/test-release-workflow.sh` after the existing macOS bundle assertions:

```bash
assert_contains "$release_workflow" "asset_os: macos"
assert_contains "$release_workflow" "asset_os: linux"
assert_contains "$release_workflow" "asset_os: windows"
assert_contains "$release_workflow" "asset_arch: x86_64"
assert_contains "$release_workflow" "asset_arch: aarch64"
assert_contains "$release_workflow" 'assetNamePattern: mpfm-v[version]-desktop-${{ matrix.asset_os }}-${{ matrix.asset_arch }}[setup][ext]'
assert_contains "$release_workflow" 'mpfm-v${VERSION}-cli-${{ matrix.asset_os }}-${{ matrix.asset_arch }}.tar.gz'
assert_contains "$release_workflow" 'mpfm-v$version-cli-${{ matrix.asset_os }}-${{ matrix.asset_arch }}.zip'
assert_contains "$release_workflow" 'path: dist/*.tar.gz'
assert_contains "$release_workflow" 'path: dist/*.zip'
assert_not_contains "$release_workflow" 'path: dist/*'

assert_contains "$workflow_readme" 'mpfm-v{version}-{type}-{os}-{arch}'
assert_contains "$workflow_readme" 'mpfm-v0.3.1-desktop-macos-aarch64.dmg'
assert_contains "$workflow_readme" 'mpfm-v0.3.1-cli-windows-x86_64.zip'
```

Because `path: dist/*.tar.gz` contains the shorter text `path: dist/*`, replace the last negative assertion with a line-oriented helper before running the test:

```bash
assert_not_line() {
  local file="$1"
  local line="$2"

  if grep -Fxq -- "$line" "$file"; then
    echo "Expected $file not to contain exact line:" >&2
    echo "$line" >&2
    exit 1
  fi
}
```

Then use:

```bash
assert_not_line "$release_workflow" "          path: dist/*"
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bash scripts/test-release-workflow.sh
```

Expected: FAIL because `.github/workflows/release.yml` does not yet contain `asset_os: macos`.

- [ ] **Step 3: Add canonical labels and names to the release workflow**

For every `publish-desktop` matrix entry, add its canonical labels:

```yaml
asset_os: macos
asset_arch: aarch64
```

Use `macos/x86_64`, `linux/x86_64`, and `windows/x86_64` for the other standard desktop entries. Add this input to the Tauri Action step:

```yaml
assetNamePattern: mpfm-v[version]-desktop-${{ matrix.asset_os }}-${{ matrix.asset_arch }}[setup][ext]
```

For all six `build-cli` matrix entries, add canonical `asset_os` and `asset_arch` labels. Change Unix archive creation to:

```bash
tar -C "$OUT_DIR" -czf "$OUT_DIR/mpfm-v${VERSION}-cli-${{ matrix.asset_os }}-${{ matrix.asset_arch }}.tar.gz" main_cli
```

Change Windows archive creation to:

```powershell
Compress-Archive -Path "$outDir/main_cli.exe" -DestinationPath "$outDir/mpfm-v$version-cli-${{ matrix.asset_os }}-${{ matrix.asset_arch }}.zip" -Force
```

Split artifact upload by runner so unpackaged executables cannot be uploaded:

```yaml
- name: Upload CLI artifact (Unix)
  if: runner.os != 'Windows'
  uses: actions/upload-artifact@v4
  with:
    name: cli-${{ matrix.target }}
    path: dist/*.tar.gz
    if-no-files-found: error

- name: Upload CLI artifact (Windows)
  if: runner.os == 'Windows'
  uses: actions/upload-artifact@v4
  with:
    name: cli-${{ matrix.target }}
    path: dist/*.zip
    if-no-files-found: error
```

- [ ] **Step 4: Document the canonical naming convention**

Add a `制品命名` subsection under the release workflow's current artifact coverage in `.github/workflows/README.md`:

```markdown
**制品命名：**

所有 GitHub Release 制品统一使用 `mpfm-v{version}-{type}-{os}-{arch}[-{variant}].{extension}`。其中操作系统固定为 `macos`、`linux`、`windows`，架构固定为 `x86_64`、`aarch64`。例如：

- `mpfm-v0.3.1-desktop-macos-aarch64.dmg`
- `mpfm-v0.3.1-desktop-linux-x86_64.AppImage`
- `mpfm-v0.3.1-cli-windows-x86_64.zip`

该规则只改变 GitHub Release 的下载文件名，不改变安装后的应用名称或 CLI 压缩包内的可执行文件名。
```

- [ ] **Step 5: Run the focused test to verify it passes**

Run:

```bash
bash scripts/test-release-workflow.sh
```

Expected: `[test-release-workflow] OK`.

- [ ] **Step 6: Commit the standard asset naming change**

```bash
git add scripts/test-release-workflow.sh .github/workflows/release.yml .github/workflows/README.md
git commit -m "ci: standardize desktop and cli asset names"
```

---

### Task 2: Canonical fixed WebView2 asset names

**Files:**
- Modify: `scripts/test-release-workflow.sh`
- Modify: `scripts/rename-fixed-webview2-artifacts.ps1`
- Modify: `scripts/publish-fixed-webview2-assets.ps1`

**Interfaces:**
- Consumes: Rust targets `x86_64-pc-windows-msvc` and `aarch64-pc-windows-msvc`, the version and WiX language in `tauri.win.conf.json`, and release tags in `v<version>` form.
- Produces: canonical fixed WebView2 MSI, NSIS, and optional MSI updater ZIP filenames selected by exact version and architecture during upload.

- [ ] **Step 1: Write the failing fixed WebView2 assertions**

Add script path variables near the top of `scripts/test-release-workflow.sh`:

```bash
rename_fixed_webview2="$repo_root/scripts/rename-fixed-webview2-artifacts.ps1"
publish_fixed_webview2="$repo_root/scripts/publish-fixed-webview2-assets.ps1"
```

Add these assertions before the final success message:

```bash
assert_contains "$rename_fixed_webview2" '"x86_64-pc-windows-msvc" { "x86_64" }'
assert_contains "$rename_fixed_webview2" '"aarch64-pc-windows-msvc" { "aarch64" }'
assert_contains "$rename_fixed_webview2" '$assetBase = "mpfm-v$version-desktop-windows-$assetArch-fixed-webview2"'
assert_contains "$rename_fixed_webview2" '$newName = "$assetBase-$wixLanguage.msi"'
assert_contains "$rename_fixed_webview2" '$newName = "$assetBase-setup.exe"'
assert_contains "$publish_fixed_webview2" '$assetBase = "mpfm-v$version-desktop-windows-$assetArch-fixed-webview2"'
assert_contains "$publish_fixed_webview2" '"$bundleRoot/msi/$assetBase-*.msi"'
assert_contains "$publish_fixed_webview2" '"$bundleRoot/nsis/$assetBase-setup.exe"'
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bash scripts/test-release-workflow.sh
```

Expected: FAIL because the rename script does not yet contain the canonical target mapping.

- [ ] **Step 3: Implement canonical fixed WebView2 renaming**

After `$ErrorActionPreference = "Stop"`, parse configuration and target labels:

```powershell
$config = Get-Content -Path ".\tauri.win.conf.json" -Raw | ConvertFrom-Json
$version = $config.version
$wixLanguage = $config.bundle.windows.wix.language
$assetArch = switch ($Target) {
    "x86_64-pc-windows-msvc" { "x86_64" }
    "aarch64-pc-windows-msvc" { "aarch64" }
    default { throw "Unsupported Windows target for release asset naming: $Target" }
}
$assetBase = "mpfm-v$version-desktop-windows-$assetArch-fixed-webview2"
```

Replace the old suffix-only rename branches with:

```powershell
if ($file.Name -match "\.msi\.zip$") {
    $newName = "$assetBase-$wixLanguage.msi.zip"
}
elseif ($file.Extension -eq ".msi") {
    $newName = "$assetBase-$wixLanguage.msi"
}
elseif ($file.Extension -eq ".exe") {
    $newName = "$assetBase-setup.exe"
}
```

Keep the existing zero-renamed hard failure.

- [ ] **Step 4: Restrict fixed WebView2 publishing to canonical names**

In `scripts/publish-fixed-webview2-assets.ps1`, validate the tag and map the target:

```powershell
if ($Tag -notmatch '^v(?<version>\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$') {
    throw "Release tag must use v<semver> format, got: $Tag"
}

$version = $matches.version
$assetArch = switch ($Target) {
    "x86_64-pc-windows-msvc" { "x86_64" }
    "aarch64-pc-windows-msvc" { "aarch64" }
    default { throw "Unsupported Windows target for release asset publishing: $Target" }
}
$assetBase = "mpfm-v$version-desktop-windows-$assetArch-fixed-webview2"
```

Use only canonical patterns:

```powershell
$patterns = @(
    "$bundleRoot/msi/$assetBase-*.msi",
    "$bundleRoot/nsis/$assetBase-setup.exe",
    "$bundleRoot/msi/$assetBase-*.msi.zip"
)
```

Keep the existing requirements for at least one MSI and one EXE.

- [ ] **Step 5: Run the focused workflow test**

Run:

```bash
bash scripts/test-release-workflow.sh
```

Expected: `[test-release-workflow] OK`.

- [ ] **Step 6: Run PowerShell parser validation when PowerShell is available**

Run:

```bash
if command -v pwsh >/dev/null 2>&1; then
  pwsh -NoProfile -Command '$errors=$null; [System.Management.Automation.Language.Parser]::ParseFile("scripts/rename-fixed-webview2-artifacts.ps1", [ref]$null, [ref]$errors) > $null; [System.Management.Automation.Language.Parser]::ParseFile("scripts/publish-fixed-webview2-assets.ps1", [ref]$null, [ref]$errors) > $null; if ($errors) { $errors | ForEach-Object { Write-Error $_ }; exit 1 }'
else
  echo "pwsh unavailable; PowerShell syntax will be covered by GitHub Actions"
fi
```

Expected: exit 0, either with no parser errors or the explicit unavailable message.

- [ ] **Step 7: Commit fixed WebView2 naming**

```bash
git add scripts/test-release-workflow.sh scripts/rename-fixed-webview2-artifacts.ps1 scripts/publish-fixed-webview2-assets.ps1
git commit -m "ci: standardize fixed webview2 asset names"
```

---

### Task 3: Final release workflow verification

**Files:**
- Verify: `.github/workflows/release.yml`
- Verify: `.github/workflows/README.md`
- Verify: `scripts/test-release-workflow.sh`
- Verify: `scripts/rename-fixed-webview2-artifacts.ps1`
- Verify: `scripts/publish-fixed-webview2-assets.ps1`

**Interfaces:**
- Consumes: the completed Task 1 and Task 2 changes.
- Produces: evidence that all canonical naming rules pass repository checks without modifying installed application metadata.

- [ ] **Step 1: Run release workflow checks**

```bash
bash scripts/test-release-workflow.sh
bash scripts/test-release-notes.sh
bash scripts/release-version.sh --expect-tag v0.3.0
```

Expected: both test scripts report `OK`, and the version command prints `0.3.0`.

- [ ] **Step 2: Validate YAML and unchanged product metadata**

```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/release.yml", aliases: true); puts "release.yml OK"'
jq -e '.productName == "mpfm" and .mainBinaryName == "mpfm" and .identifier == "com.mpfm.app"' tauri.conf.json tauri.win.conf.json
```

Expected: `release.yml OK` and two `true` results.

- [ ] **Step 3: Check the final diff**

```bash
git diff --check
git status --short
git log -3 --oneline
```

Expected: no whitespace errors; only the intended plan document may remain uncommitted if it was not committed separately; the latest commits describe the two asset naming changes.
