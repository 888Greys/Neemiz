# Copies SSH private keys from this Windows PC into one .txt on the Desktop.
# Safe to run: only reads %USERPROFILE%\.ssh and writes to Desktop.

$ErrorActionPreference = "Stop"

$sshDir = Join-Path $env:USERPROFILE ".ssh"
$desktop = [Environment]::GetFolderPath("Desktop")
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$txtPath = Join-Path $desktop "server-keys-$stamp.txt"

if (-not (Test-Path $sshDir)) {
    Write-Host ""
    Write-Host "No .ssh folder found at: $sshDir" -ForegroundColor Yellow
    Write-Host "Keys may be somewhere else on this laptop."
    Write-Host "Press Enter to close..."
    Read-Host | Out-Null
    exit 1
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("SSH keys export from $env:COMPUTERNAME")
$lines.Add("User: $env:USERNAME")
$lines.Add("Folder: $sshDir")
$lines.Add("Exported: $(Get-Date -Format o)")
$lines.Add("")

# Prefer private key files; also include .pub and config so nothing useful is missed.
$files = Get-ChildItem -Path $sshDir -File | Sort-Object Name
if ($files.Count -eq 0) {
    Write-Host ""
    Write-Host ".ssh folder is empty." -ForegroundColor Yellow
    Write-Host "Press Enter to close..."
    Read-Host | Out-Null
    exit 1
}

foreach ($file in $files) {
    $lines.Add("========== FILE: $($file.Name) ==========")
    $lines.Add((Get-Content -LiteralPath $file.FullName -Raw -ErrorAction SilentlyContinue))
    $lines.Add("")
    $lines.Add("")
}

[System.IO.File]::WriteAllLines($txtPath, $lines)

# Open Desktop so the .txt is easy to find
Start-Process explorer.exe $desktop

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "Send this file:" -ForegroundColor Cyan
Write-Host "  $txtPath"
Write-Host ""
Write-Host "Press Enter to close..."
Read-Host | Out-Null
