$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$renameScript = Join-Path $PSScriptRoot "rename-fixed-webview2-artifacts.ps1"
$publishScript = Join-Path $PSScriptRoot "publish-fixed-webview2-assets.ps1"
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) "mpfm-fixed-webview2-$([guid]::NewGuid())"

function Assert-PathExists {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Expected path to exist: $Path"
    }
}

function Assert-Throws {
    param(
        [Parameter(Mandatory = $true)][scriptblock]$Action,
        [Parameter(Mandatory = $true)][string]$MessagePattern
    )

    $threw = $false
    try {
        & $Action
    }
    catch {
        $threw = $true
        if ($_.Exception.Message -notmatch $MessagePattern) {
            throw "Expected error matching '$MessagePattern', got: $($_.Exception.Message)"
        }
    }

    if (-not $threw) {
        throw "Expected action to throw an error matching: $MessagePattern"
    }
}

New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

try {
    Copy-Item (Join-Path $repoRoot "tauri.win.conf.json") (Join-Path $testRoot "tauri.win.conf.json")

    $target = "x86_64-pc-windows-msvc"
    $bundleRoot = Join-Path $testRoot "target/$target/release/bundle"
    $msiDir = Join-Path $bundleRoot "msi"
    $nsisDir = Join-Path $bundleRoot "nsis"
    New-Item -ItemType Directory -Force -Path $msiDir, $nsisDir | Out-Null

    New-Item -ItemType File -Path (Join-Path $msiDir "mpfm_0.3.0_x64_zh-CN.msi") | Out-Null
    New-Item -ItemType File -Path (Join-Path $msiDir "mpfm_0.3.0_x64_zh-CN.msi.zip") | Out-Null
    New-Item -ItemType File -Path (Join-Path $nsisDir "mpfm_0.3.0_x64-setup.exe") | Out-Null

    Push-Location $testRoot
    try {
        & $renameScript -Target $target
    }
    finally {
        Pop-Location
    }

    $assetBase = "mpfm-v0.3.0-desktop-windows-x86_64-fixed-webview2"
    $expectedMsi = Join-Path $msiDir "$assetBase-zh-CN.msi"
    $expectedMsiZip = Join-Path $msiDir "$assetBase-zh-CN.msi.zip"
    $expectedExe = Join-Path $nsisDir "$assetBase-setup.exe"
    Assert-PathExists $expectedMsi
    Assert-PathExists $expectedMsiZip
    Assert-PathExists $expectedExe

    Assert-Throws -MessagePattern "Unsupported Windows target for release asset naming" -Action {
        Push-Location $testRoot
        try {
            & $renameScript -Target "i686-pc-windows-msvc"
        }
        finally {
            Pop-Location
        }
    }

    New-Item -ItemType File -Path (Join-Path $msiDir "mpfm-v0.2.9-desktop-windows-x86_64-fixed-webview2-zh-CN.msi") | Out-Null
    New-Item -ItemType File -Path (Join-Path $nsisDir "mpfm-v0.2.9-desktop-windows-x86_64-fixed-webview2-setup.exe") | Out-Null

    $global:MpfmGhCalls = @()
    function global:gh {
        $global:MpfmGhCalls += ,([string[]]$args)
        $global:LASTEXITCODE = 0
    }

    Push-Location $testRoot
    try {
        & $publishScript -Target $target -Tag "v0.3.0"
    }
    finally {
        Pop-Location
    }

    $uploadCall = $global:MpfmGhCalls |
        Where-Object { $_.Count -ge 2 -and $_[0] -eq "release" -and $_[1] -eq "upload" } |
        Select-Object -First 1
    if (-not $uploadCall) {
        throw "Expected publish script to call gh release upload"
    }

    $uploadText = $uploadCall -join "`n"
    foreach ($expectedName in @(
            "$assetBase-zh-CN.msi",
            "$assetBase-zh-CN.msi.zip",
            "$assetBase-setup.exe"
        )) {
        if ($uploadText -notmatch [regex]::Escape($expectedName)) {
            throw "Expected gh upload to include: $expectedName"
        }
    }
    if ($uploadText -match "v0\.2\.9") {
        throw "Expected gh upload to exclude assets from other versions"
    }

    Remove-Item -LiteralPath $expectedMsi, $expectedMsiZip
    Assert-Throws -MessagePattern "Expected at least one MSI and one EXE" -Action {
        Push-Location $testRoot
        try {
            & $publishScript -Target $target -Tag "v0.3.0"
        }
        finally {
            Pop-Location
        }
    }

    New-Item -ItemType File -Path $expectedMsi | Out-Null
    Remove-Item -LiteralPath $expectedExe
    Assert-Throws -MessagePattern "Expected at least one MSI and one EXE" -Action {
        Push-Location $testRoot
        try {
            & $publishScript -Target $target -Tag "v0.3.0"
        }
        finally {
            Pop-Location
        }
    }

    Assert-Throws -MessagePattern "Unsupported Windows target for release asset publishing" -Action {
        Push-Location $testRoot
        try {
            & $publishScript -Target "i686-pc-windows-msvc" -Tag "v0.3.0"
        }
        finally {
            Pop-Location
        }
    }

    Write-Host "[test-fixed-webview2-assets] OK"
}
finally {
    Remove-Item -Path Function:\gh -ErrorAction SilentlyContinue
    Remove-Variable -Name MpfmGhCalls -Scope Global -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
}
