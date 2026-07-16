# Release Asset Naming Design

## Goal

Make every future GitHub Release asset identify its application type, operating system, and CPU architecture directly from its filename.

## Scope

This change only affects filenames shown and downloaded from GitHub Releases. It does not change:

- the installed desktop application name;
- Tauri's `productName`, `mainBinaryName`, application identifier, or installer metadata;
- the CLI binary name inside an archive (`main_cli` on Unix and `main_cli.exe` on Windows);
- the supported operating systems, architectures, bundle formats, or build commands.

## Naming Convention

Release asset names use this structure:

```text
mpfm-v{version}-{type}-{os}-{arch}[-{variant}].{extension}
```

The controlled values are:

- `type`: `desktop` or `cli`;
- `os`: `macos`, `linux`, or `windows`;
- `arch`: `x86_64` or `aarch64`;
- `variant`: an optional bundle distinction such as `setup` or `fixed-webview2`.

Examples:

```text
mpfm-v0.3.1-desktop-macos-aarch64.dmg
mpfm-v0.3.1-desktop-linux-x86_64.AppImage
mpfm-v0.3.1-desktop-linux-x86_64.deb
mpfm-v0.3.1-desktop-windows-x86_64-setup.exe
mpfm-v0.3.1-desktop-windows-aarch64-fixed-webview2-setup.exe
mpfm-v0.3.1-cli-linux-aarch64.tar.gz
mpfm-v0.3.1-cli-windows-x86_64.zip
```

When an installer filename needs a locale to distinguish otherwise identical assets, the locale remains an additional variant segment.

## Implementation Design

### Standard desktop bundles

The desktop build matrix will carry explicit `asset_os` and `asset_arch` values. `tauri-apps/tauri-action@v0` will use `assetNamePattern` to rename uploaded Release assets while leaving the locally built bundle and its internal application metadata unchanged.

### CLI archives

The CLI matrix will carry explicit `asset_os` and `asset_arch` values and use them when creating archive filenames. Artifact upload will include only the platform archive, not the unpackaged `main_cli` or `main_cli.exe` copied into the staging directory.

### Fixed WebView2 installers

The existing PowerShell rename script will derive the version from Tauri configuration and map the Rust target to the controlled architecture value. It will rename the upload files to the common convention while preserving the installers' internal product name and metadata.

The publishing script will only select files matching the new convention. Missing MSI or NSIS assets remain a hard failure so a partially named release cannot silently succeed.

## Data Flow

1. The release tag is validated against the project version.
2. Each build matrix entry supplies canonical OS and architecture labels.
3. Desktop bundles are renamed by `tauri-action` during upload.
4. CLI jobs create exactly one canonical archive per matrix entry.
5. Fixed WebView2 jobs rename their generated installers before upload.
6. Existing publishing steps upload only canonical assets to the draft Release.

## Validation

`scripts/test-release-workflow.sh` will verify:

- every desktop matrix entry defines canonical OS and architecture labels;
- the desktop action uses the canonical Release asset pattern;
- all six CLI archive names follow the convention;
- CLI artifact upload cannot include bare executables;
- fixed WebView2 scripts produce and select canonical Windows filenames;
- documentation describes the new naming rule and examples.

The existing release workflow checks and relevant PowerShell syntax checks will run after the implementation.

## Compatibility

The change intentionally alters future GitHub Release download URLs because the filenames change. No existing v0.3.0 asset is renamed or deleted. Application installation paths, application display names, bundle identifiers, update keys, and runtime behavior remain unchanged.
