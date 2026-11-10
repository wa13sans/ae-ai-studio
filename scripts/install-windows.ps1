[CmdletBinding()]
param([switch]$EnableDebugMode)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$source = [IO.Path]::GetFullPath((Join-Path $projectRoot 'extension'))
if (-not (Test-Path -LiteralPath (Join-Path $source 'CSXS\manifest.xml') -PathType Leaf)) {
    throw 'Extension manifest not found. Extract the complete archive before running this installer.'
}
if ([string]::IsNullOrWhiteSpace($env:APPDATA)) { throw 'APPDATA is not available.' }
$parent = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Adobe\CEP\extensions'))
$target = [IO.Path]::GetFullPath((Join-Path $parent 'com.aeaistudio.panel'))
if ([IO.Path]::GetDirectoryName($target) -ne $parent -or [IO.Path]::GetFileName($target) -ne 'com.aeaistudio.panel') {
    throw 'Unexpected installation path.'
}
if ($target -eq $source -or $source.StartsWith($target + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Run the installer outside the installed extension directory.'
}
New-Item -ItemType Directory -Path $parent -Force | Out-Null
if (Test-Path -LiteralPath $target) {
    $item = Get-Item -LiteralPath $target -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'The installation target cannot be a link.' }
    $backupName = 'com.aeaistudio.panel.backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 6)
    $backupRoot = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetDirectoryName($parent)) 'ae-ai-studio-backups'))
    if ([IO.Path]::GetDirectoryName($backupRoot) -ne [IO.Path]::GetDirectoryName($parent)) { throw 'Unexpected backup directory.' }
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    $backup = [IO.Path]::GetFullPath((Join-Path $backupRoot $backupName))
    if ([IO.Path]::GetDirectoryName($backup) -ne $backupRoot) { throw 'Unexpected backup path.' }
    Move-Item -LiteralPath $target -Destination $backup
    Write-Host ('Previous installation preserved: ' + $backup)
}
Copy-Item -LiteralPath $source -Destination $target -Recurse
if ($EnableDebugMode) {
    foreach ($version in @('11', '12')) {
        $key = 'HKCU:\Software\Adobe\CSXS.' + $version
        New-Item -Path $key -Force | Out-Null
        New-ItemProperty -Path $key -Name PlayerDebugMode -Value '1' -PropertyType String -Force | Out-Null
    }
    Write-Host 'CEP debug mode enabled for this user (CSXS.11 and CSXS.12). This also permits other unsigned CEP extensions.'
}
Write-Host ('Installed: ' + $target)
Write-Host 'Restart After Effects, then open Window > Extensions > AE AI Studio.'
if (-not $EnableDebugMode) {
    Write-Host 'This unsigned beta needs CEP debug mode. To opt in, rerun with -EnableDebugMode.'
}
