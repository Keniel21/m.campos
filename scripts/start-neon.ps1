param([string]$ConfigFile = '.env.neon')
$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
if (-not [IO.Path]::IsPathRooted($ConfigFile)) { $ConfigFile = Join-Path $repoPath $ConfigFile }
if (-not (Test-Path -LiteralPath $ConfigFile)) { throw 'Copie .env.neon.example para .env.neon e configure os valores localmente.' }
$allowed = @('DB_URL','DB_USER','DB_PASSWORD','JWT_SECRET','ADMIN_EMAIL','ADMIN_PASSWORD','DB_MIGRATE','IMPORT_DIRECTORY','APP_PORT')
$settings = @{}
foreach ($line in [IO.File]::ReadAllLines($ConfigFile)) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }
    $parts = $line.Split(@('='), 2)
    if ($parts.Length -ne 2 -or $allowed -notcontains $parts[0].Trim()) { throw 'Configuracao desconhecida ou invalida no arquivo local.' }
    $key = $parts[0].Trim()
    if ($settings.ContainsKey($key)) { throw "Configuracao duplicada: $key" }
    $settings[$key] = $parts[1]
}
foreach ($key in @('DB_URL','DB_USER','DB_PASSWORD','JWT_SECRET','ADMIN_EMAIL','ADMIN_PASSWORD')) {
    if ([string]::IsNullOrWhiteSpace($settings[$key])) { throw "Preencha $key no arquivo local." }
}
if ($settings.DB_URL -notmatch '^jdbc:postgresql://[^/@?:]+\.neon\.tech(?::5432)?/[A-Za-z0-9_-]+$') {
    throw 'DB_URL deve conter apenas host Neon e banco no formato JDBC, sem senha nem parametros TLS.'
}
if ([Text.Encoding]::UTF8.GetByteCount($settings.JWT_SECRET) -lt 32) { throw 'JWT_SECRET precisa ter pelo menos 32 bytes aleatorios.' }
if ($settings.ADMIN_PASSWORD.Length -lt 12 -or [Text.Encoding]::UTF8.GetByteCount($settings.ADMIN_PASSWORD) -gt 72) { throw 'ADMIN_PASSWORD precisa ter de 12 caracteres a 72 bytes.' }
if ($settings.DB_MIGRATE -and $settings.DB_MIGRATE -notin @('true','false')) { throw 'DB_MIGRATE aceita true ou false.' }
if ($settings.IMPORT_DIRECTORY -and $settings.DB_MIGRATE -ne 'true') { throw 'Use a credencial de manutencao e DB_MIGRATE=true para importar.' }
if ($settings.IMPORT_DIRECTORY) {
    $sourcePath = $settings.IMPORT_DIRECTORY
    if (-not [IO.Path]::IsPathRooted($sourcePath)) { $sourcePath = Join-Path $repoPath $sourcePath }
    $settings.IMPORT_DIRECTORY = (Resolve-Path -LiteralPath $sourcePath).Path
    & node (Join-Path $PSScriptRoot 'audit-legacy.cjs') $settings.IMPORT_DIRECTORY
    if ($LASTEXITCODE -ne 0) { throw 'A auditoria bloqueou a importacao. Corrija os erros indicados.' }
}
$jarPath = Join-Path $repoPath 'backend/target/crm-2.0.0-SNAPSHOT.jar'
if (-not (Test-Path -LiteralPath $jarPath)) { throw 'Compile primeiro: mvn -f backend/pom.xml verify' }
$previous = @{}
try {
    foreach ($key in $allowed) {
        $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        [Environment]::SetEnvironmentVariable($key, $settings[$key], 'Process')
    }
    # Credentials stay in the child environment, never in command-line arguments.
    Push-Location $repoPath
    try { & java -jar $jarPath '--spring.profiles.active=neon,desktop' }
    finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw 'A API encerrou com erro. Confira o log local.' }
} finally {
    foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
}
