param(
    [string]$ConfigFile = '.env.neon.maintenance',
    [string]$PgBin = $env:PG_BIN,
    [string]$Destination = 'backups',
    [string]$ApplicationRevision = 'unspecified'
)
$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
if (-not $PgBin) { $PgBin = Join-Path $env:ProgramFiles 'PostgreSQL/18/bin' }
if (-not [IO.Path]::IsPathRooted($PgBin)) { $PgBin = Join-Path $repoPath $PgBin }
if (-not [IO.Path]::IsPathRooted($Destination)) { $Destination = Join-Path $repoPath $Destination }
if (-not [IO.Path]::IsPathRooted($ConfigFile)) { $ConfigFile = Join-Path $repoPath $ConfigFile }
$resultText = & node (Join-Path $PSScriptRoot 'backup.cjs') --config $ConfigFile --pg-bin $PgBin --destination $Destination --revision $ApplicationRevision
if ($LASTEXITCODE -ne 0) { throw 'O backup nao foi concluido. Nenhum pacote deve ser tratado como valido sem verificacao.' }
$result = $resultText | ConvertFrom-Json
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archivePath = $result.folder + '.zip'
if (Test-Path -LiteralPath $archivePath) { throw 'O arquivo ZIP ja existe; nao sera sobrescrito.' }
[IO.Compression.ZipFile]::CreateFromDirectory($result.folder,$archivePath,[IO.Compression.CompressionLevel]::Optimal,$false)
$checksum = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText($archivePath+'.sha256',$checksum+'  '+[IO.Path]::GetFileName($archivePath)+[Environment]::NewLine)
Write-Output ('Backup conferido e compactado: '+$archivePath)
Write-Output ('Documentos vinculados: '+$result.documents)
