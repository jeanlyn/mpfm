param(
    [Parameter(Mandatory = $true)]
    [string]$Target
)

$ErrorActionPreference = "Stop"

$config = Get-Content -Path ".\tauri.win.conf.json" -Raw | ConvertFrom-Json
$version = $config.version
$wixLanguage = $config.bundle.windows.wix.language
$assetArch = switch ($Target) {
    "x86_64-pc-windows-msvc" { "x86_64" }
    "aarch64-pc-windows-msvc" { "aarch64" }
    default { throw "Unsupported Windows target for release asset naming: $Target" }
}
$assetBase = "mpfm-v$version-desktop-windows-$assetArch-fixed-webview2"

$bundleDir = Get-ChildItem -Path ".\target\$Target" -Recurse -Directory -Filter "bundle" |
    Select-Object -First 1 -ExpandProperty FullName

if (-not $bundleDir) {
    throw "Could not find bundle directory in .\target\$Target"
}

Write-Host "Renaming fixed WebView2 artifacts in $bundleDir..."
$renamedCount = 0

Get-ChildItem -Path $bundleDir -Recurse -File | ForEach-Object {
    $file = $_
    $newName = $null

    if ($file.Name -match "\.msi\.zip$") {
        $newName = "$assetBase-$wixLanguage.msi.zip"
    }
    elseif ($file.Extension -eq ".msi") {
        $newName = "$assetBase-$wixLanguage.msi"
    }
    elseif ($file.Extension -eq ".exe") {
        $newName = "$assetBase-setup.exe"
    }

    if ($newName) {
        Rename-Item -Path $file.FullName -NewName $newName -Force
        Write-Host "Renamed '$($file.Name)' to '$newName'"
        $renamedCount++
    }
}

if ($renamedCount -eq 0) {
    throw "No Windows installer artifacts were renamed in $bundleDir"
}

Write-Host "Renamed $renamedCount artifact(s)."
