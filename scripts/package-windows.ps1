param(
    [Parameter(Mandatory=$true)][string]$Jar,
    [Parameter(Mandatory=$true)][string]$JavaHome,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-zA-Z0-9.-]+$')][string]$Version,
    [Parameter(Mandatory=$true)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$jarFile = (Resolve-Path -LiteralPath $Jar).Path
$jdk = (Resolve-Path -LiteralPath $JavaHome).Path
$output = [IO.Path]::GetFullPath($OutputDirectory)
$bundle = Join-Path $output "Mcampos-$Version"
if (Test-Path -LiteralPath $bundle) { throw 'Use uma pasta de destino nova; nenhum pacote existente sera sobrescrito.' }
if (-not (Test-Path -LiteralPath (Join-Path $jdk 'bin/jlink.exe'))) { throw 'Informe um JDK 21 Windows com jlink.' }
New-Item -ItemType Directory -Path $bundle -Force | Out-Null
Copy-Item -LiteralPath $jarFile -Destination (Join-Path $bundle 'app.jar')
& (Join-Path $jdk 'bin/jlink.exe') --module-path (Join-Path $jdk 'jmods') --add-modules ALL-MODULE-PATH --strip-debug --no-header-files --no-man-pages --output (Join-Path $bundle 'runtime')
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar o Java incluido.' }
$web = Join-Path $bundle 'web'
New-Item -ItemType Directory -Path $web | Out-Null
# Explicit allowlist: never copy database files, documents, logs or credentials.
foreach ($asset in @('index.html','style.css','app.js','service-worker.js','manifest.json','firebase-applet-config.json','src')) {
    Copy-Item -LiteralPath (Join-Path $repo $asset) -Destination $web -Recurse
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'windows/Start-Mcampos.ps1') -Destination $bundle
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'windows/Iniciar.cmd') -Destination $bundle
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'windows/Install-Mcampos.ps1') -Destination $bundle
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'windows/config.env.example') -Destination $bundle
Copy-Item -LiteralPath (Join-Path $repo 'docs/windows.md') -Destination (Join-Path $bundle 'LEIA-ME.md')
$Version | Set-Content -LiteralPath (Join-Path $bundle 'VERSION') -Encoding ascii
$zip = "$bundle.zip"
if (Test-Path -LiteralPath $zip) { throw 'O ZIP de destino ja existe.' }
Compress-Archive -Path (Join-Path $bundle '*') -DestinationPath $zip
$hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  $([IO.Path]::GetFileName($zip))" | Set-Content -LiteralPath "$zip.sha256" -Encoding ascii
Write-Output "Pacote criado: $zip"
