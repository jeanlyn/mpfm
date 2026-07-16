param(
    [Parameter(Mandatory = $true)]
    [string]$Target,

    [Parameter(Mandatory = $true)]
    [string]$Tag
)

$ErrorActionPreference = "Stop"

if ($Tag -match '^v(?<version>\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$') {
    $version = $matches.version
}
else {
    throw "Release tag must use v<semver> format, got: $Tag"
}

$assetArch = switch ($Target) {
    "x86_64-pc-windows-msvc" { "x86_64" }
    "aarch64-pc-windows-msvc" { "aarch64" }
    default { throw "Unsupported Windows target for release asset publishing: $Target" }
}
$assetBase = "mpfm-v$version-desktop-windows-$assetArch-fixed-webview2"

$bundleRoot = "target/$Target/release/bundle"
$patterns = @(
    "$bundleRoot/msi/$assetBase-*.msi",
    "$bundleRoot/nsis/$assetBase-setup.exe",
    "$bundleRoot/msi/$assetBase-*.msi.zip"
)

$files = @()
foreach ($pattern in $patterns) {
    $files += Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue
}

$files = $files | Sort-Object -Property FullName -Unique

if ($files.Count -eq 0) {
    throw "No fixed-webview2 artifacts found under $bundleRoot"
}

$msiCount = ($files | Where-Object { $_.Extension -eq ".msi" }).Count
$exeCount = ($files | Where-Object { $_.Extension -eq ".exe" }).Count

if ($msiCount -lt 1 -or $exeCount -lt 1) {
    throw "Expected at least one MSI and one EXE fixed-webview2 artifact, found $msiCount MSI and $exeCount EXE"
}

Write-Host "Publishing $($files.Count) fixed-webview2 asset(s) to ${Tag}:"
$files | ForEach-Object { Write-Host "  $($_.FullName)" }

gh release view $Tag *> $null
if ($LASTEXITCODE -ne 0) {
    gh release create $Tag `
        --draft `
        --title "mpfm $Tag" `
        --notes "See the assets to download this version and install."
}

gh release upload $Tag ($files.FullName) --clobber

Write-Host "Upload complete."
