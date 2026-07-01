param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("x64", "arm64")]
    [string]$Arch,

    [string]$WebViewVersion = "133.0.3065.92",

    [string]$ConfigPath = "tauri.win.conf.json"
)

$ErrorActionPreference = "Stop"

$fileName = "Microsoft.WebView2.FixedVersionRuntime.$WebViewVersion.$Arch.cab"
$extractPath = "Microsoft.WebView2.FixedVersionRuntime.$WebViewVersion.$Arch"
$url = "https://github.com/westinyang/WebView2RuntimeArchive/releases/download/$WebViewVersion/$fileName"
$runtimePath = "./$extractPath/"

Write-Host "Downloading WebView2 Runtime for $Arch ($WebViewVersion)..."
Invoke-WebRequest -Uri $url -OutFile $fileName -UseBasicParsing

Write-Host "Extracting WebView2 Runtime to $extractPath..."
Expand .\$fileName -F:* ./

Write-Host "Updating $ConfigPath with WebView2 path: $runtimePath"
node -e "const fs=require('fs'); const p=process.argv[1]; const runtimePath=process.argv[2]; const config=JSON.parse(fs.readFileSync(p,'utf8')); config.bundle.windows.webviewInstallMode.path=runtimePath; fs.writeFileSync(p, JSON.stringify(config, null, 2)+'\n', 'utf8');" $ConfigPath $runtimePath

Write-Host "WebView2 runtime setup complete."
