param(
    [Parameter(Mandatory=$true)][string]$PackageDirectory,
    [Parameter(Mandatory=$true)][string]$PrivateConfigFile,
    [Parameter(Mandatory=$true)][string]$DocumentsDirectory,
    [string]$DataDirectory = (Join-Path $env:LOCALAPPDATA 'Mcampos'),
    [ValidateRange(1024,65535)][int]$Port = 18080,
    [switch]$NoShortcut
)
$ErrorActionPreference='Stop'
$package=(Resolve-Path -LiteralPath $PackageDirectory).Path
$sourceDocuments=(Resolve-Path -LiteralPath $DocumentsDirectory).Path
$data=[IO.Path]::GetFullPath($DataDirectory)
if (Test-Path -LiteralPath $data) { throw 'A pasta de dados ja existe. Este instalador e apenas para uma instalacao inicial em pasta nova.' }
foreach ($file in @('app.jar','runtime/bin/java.exe','Start-Mcampos.ps1','Iniciar.cmd','web/index.html','VERSION')) {
    if (-not (Test-Path -LiteralPath (Join-Path $package $file) -PathType Leaf)) { throw "Pacote incompleto: $file" }
}
$version=(Get-Content -LiteralPath (Join-Path $package 'VERSION') -Raw).Trim()
if ($version -notmatch '^[A-Za-z0-9.-]+$') { throw 'Versao invalida.' }
$allowed=@('DB_URL','DB_USER','DB_PASSWORD','JWT_SECRET','ADMIN_EMAIL','ADMIN_PASSWORD')
$settings=@{}
foreach ($line in [IO.File]::ReadAllLines((Resolve-Path -LiteralPath $PrivateConfigFile).Path)) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }
    $parts=$line.Split([char[]]@('='),2,[StringSplitOptions]::None)
    if ($parts.Length -ne 2) { throw 'Configuracao invalida.' }
    $key=$parts[0].Trim()
    if ($allowed -contains $key) {
        if ($settings.ContainsKey($key)) { throw "Campo duplicado: $key" }
        $settings[$key]=$parts[1]
    }
}
foreach ($key in $allowed) { if ([string]::IsNullOrWhiteSpace($settings[$key])) { throw "Campo ausente: $key" } }
if ($settings.DB_USER -ne 'mcampos_local_prod') { throw 'Use a credencial limitada de producao, nunca a credencial de manutencao.' }
if ($settings.DB_URL -notmatch '^jdbc:postgresql://[^/@?:]+\.neon\.tech(?::5432)?/mcampos$') { throw 'Endereco de producao invalido.' }
if ([Text.Encoding]::UTF8.GetByteCount($settings.JWT_SECRET) -lt 32) { throw 'JWT_SECRET invalido.' }
if ($settings.ADMIN_PASSWORD.Length -lt 12 -or [Text.Encoding]::UTF8.GetByteCount($settings.ADMIN_PASSWORD) -gt 72) { throw 'ADMIN_PASSWORD invalido.' }
$documents=@(Get-ChildItem -LiteralPath $sourceDocuments -Force)
if (-not $documents.Count) { throw 'Pasta de documentos vazia.' }
foreach ($document in $documents) {
    if ($document.PSIsContainer -or ($document.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $document.Name -notmatch '^[a-f0-9]{64}$') { throw 'Arquivo inesperado na pasta de documentos.' }
    if ((Get-FileHash -LiteralPath $document.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -ne $document.Name) { throw 'Documento corrompido.' }
}
# All validation above precedes installation. Never overwrite existing user data.
$installed=Join-Path $data "versions/$version"
New-Item -ItemType Directory -Path $installed -Force | Out-Null
$acl=Get-Acl -LiteralPath $data
$acl.SetAccessRuleProtection($true,$false)
$currentUser=[Security.Principal.WindowsIdentity]::GetCurrent().User
foreach ($sid in @($currentUser,(New-Object Security.Principal.SecurityIdentifier('S-1-5-18')),(New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))) {
    $rule=New-Object Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
    $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $data -AclObject $acl
Copy-Item -Path (Join-Path $package '*') -Destination $installed -Recurse
$targetDocuments=Join-Path $data 'documents'
New-Item -ItemType Directory -Path $targetDocuments | Out-Null
foreach ($document in $documents) { Copy-Item -LiteralPath $document.FullName -Destination $targetDocuments }
$settings.APP_PORT="$Port"
$configText=(@($allowed | ForEach-Object { $_+'='+$settings[$_] })+('APP_PORT='+$Port)) -join [Environment]::NewLine
[IO.File]::WriteAllText((Join-Path $data 'config.env'),$configText+[Environment]::NewLine,(New-Object Text.UTF8Encoding($false)))
$launcher=Join-Path $data 'Abrir-Mcampos.cmd'
$launcherText='@echo off'+[Environment]::NewLine+'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "'+(Join-Path $installed 'Start-Mcampos.ps1')+'" -DataDirectory "'+$data+'"'+[Environment]::NewLine+'if errorlevel 1 pause'+[Environment]::NewLine
[IO.File]::WriteAllText($launcher,$launcherText,[Text.Encoding]::Default)
if (-not $NoShortcut) {
    $shell=New-Object -ComObject WScript.Shell
    $shortcut=$shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'M.camposoffroad.lnk'))
    $shortcut.TargetPath=$launcher
    $shortcut.WorkingDirectory=$data
    $shortcut.Save()
}
Write-Output "Instalacao preparada em $data. Abra Abrir-Mcampos.cmd para testar."
