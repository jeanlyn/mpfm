param(
    [Parameter(Mandatory = $true)]
    [string]$Target
)

$ErrorActionPreference = "Stop"

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

    if ($file.Name -match "^(.*)(\.msi\.zip)$") {
        $newName = "$($matches[1])-fixed-webview2$($matches[2])"
    }
    elseif ($file.Name -match "^(.*)(\.(msi|exe))$") {
        $newName = "$($matches[1])-fixed-webview2$($matches[2])"
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
