param([string]$DataDirectory = (Join-Path $env:LOCALAPPDATA 'Mcampos'), [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$data = [IO.Path]::GetFullPath($DataDirectory)
New-Item -ItemType Directory -Path $data -Force | Out-Null
$config = Join-Path $data 'config.env'
if (-not (Test-Path -LiteralPath $config)) { throw "Configure primeiro $config usando config.env.example. Nao inclua a credencial do proprietario do banco." }
$allowed = @('DB_URL','DB_USER','DB_PASSWORD','JWT_SECRET','ADMIN_EMAIL','ADMIN_PASSWORD','APP_PORT')
$settings = @{}
foreach ($line in [IO.File]::ReadAllLines($config)) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }
    $pair = $line.Split([char[]]@('='),2,[StringSplitOptions]::None)
    if ($pair.Length -ne 2 -or $allowed -notcontains $pair[0].Trim()) { throw 'Configuracao invalida.' }
    $key = $pair[0].Trim()
    if ($settings.ContainsKey($key)) { throw "Campo duplicado: $key" }
    $settings[$key] = $pair[1]
}
foreach ($key in $allowed | Where-Object { $_ -ne 'APP_PORT' }) {
    if ([string]::IsNullOrWhiteSpace($settings[$key])) { throw "Preencha $key na configuracao local." }
}
if ($settings.DB_URL -notmatch '^jdbc:postgresql://[^/@?:]+\.neon\.tech(?::5432)?/[A-Za-z0-9_-]+$') { throw 'Endereco Neon JDBC invalido.' }
if ([Text.Encoding]::UTF8.GetByteCount($settings.JWT_SECRET) -lt 32) { throw 'JWT_SECRET exige pelo menos 32 bytes.' }
if ($settings.ADMIN_PASSWORD.Length -lt 12 -or [Text.Encoding]::UTF8.GetByteCount($settings.ADMIN_PASSWORD) -gt 72) { throw 'Senha administrativa invalida.' }
$port = 18080
if ($settings.APP_PORT -and (-not [int]::TryParse($settings.APP_PORT,[ref]$port) -or $port -lt 1024 -or $port -gt 65535)) { throw 'Porta invalida.' }
$url = "http://127.0.0.1:$port/"
# Do not reuse an unknown listener or start two instances on the same port.
$probe = New-Object Net.Sockets.TcpClient
$occupied = $false
try { $probe.Connect('127.0.0.1',$port); $occupied = $true } catch { } finally { $probe.Dispose() }
if ($occupied) { throw "A porta $port ja esta em uso. Se o sistema ja estiver aberto, acesse $url" }
$java = Join-Path $PSScriptRoot 'runtime/bin/java.exe'
$jar = Join-Path $PSScriptRoot 'app.jar'
if (-not (Test-Path -LiteralPath $java) -or -not (Test-Path -LiteralPath $jar)) { throw 'Pacote incompleto.' }
$logs = Join-Path $data 'logs'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$settings.APP_PORT = "$port"
$settings.DB_MIGRATE = 'false'
$settings.IMPORT_DIRECTORY = ''
$settings.DOCUMENT_DIRECTORY = Join-Path $data 'documents'
$settings.FRONTEND_DIRECTORY = Join-Path $PSScriptRoot 'web'
$previous = @{}
try {
    foreach ($key in $settings.Keys) {
        $previous[$key] = [Environment]::GetEnvironmentVariable($key,'Process')
        [Environment]::SetEnvironmentVariable($key,$settings[$key],'Process')
    }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $process = Start-Process -FilePath $java -ArgumentList @('-jar',('"' + $jar + '"'),'--spring.profiles.active=neon,desktop') -WorkingDirectory $data -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs "$stamp.log") -RedirectStandardError (Join-Path $logs "$stamp.error.log")
} finally {
    foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key,$previous[$key],'Process') }
}
$ready = $false
for ($attempt=0; $attempt -lt 20; $attempt++) {
    $process.Refresh()
    if ($process.HasExited) { throw "O sistema encerrou. Consulte os logs em $logs" }
    try {
        # This endpoint reads the database; startup alone does not prove connectivity.
        $response = Invoke-WebRequest -Uri ($url + 'api/desktop/crm/data') -UseBasicParsing -TimeoutSec 15
        $snapshot = $response.Content | ConvertFrom-Json
        if ($response.StatusCode -eq 200 -and $null -ne $snapshot.estoque) { $ready=$true; break }
    } catch { }
    Start-Sleep -Seconds 1
}
if (-not $ready) {
    Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
    throw "Nao foi possivel conectar. Consulte os logs em $logs"
}
$process.Id | Set-Content -LiteralPath (Join-Path $data 'app.pid') -Encoding ascii
if (-not $NoBrowser) { Start-Process -FilePath $url -WindowStyle Hidden }
Write-Output "M.camposoffroad iniciado em $url"

