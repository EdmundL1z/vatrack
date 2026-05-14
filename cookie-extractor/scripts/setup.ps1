# VaTrack Cookie Auto-Sync Setup
# Run once (as Administrator) to configure Task Scheduler and Chrome debug port.

$ErrorActionPreference = "Stop"
$ExtractorDir = Split-Path -Parent $PSScriptRoot
$RepoRoot     = Split-Path -Parent $ExtractorDir
$CheckScript  = Join-Path $PSScriptRoot "check-and-sync.js"
$LogFile      = Join-Path $ExtractorDir "sync.log"
$NodeExe      = (Get-Command node -ErrorAction SilentlyContinue).Source

Write-Host "=== VaTrack Cookie Auto-Sync Setup ===" -ForegroundColor Cyan

if (-not $NodeExe) { Write-Error "Node.js not found in PATH. Install it first."; exit 1 }

# ── Task Scheduler ────────────────────────────────────────────────────────────
$psArgs = "-NonInteractive -WindowStyle Hidden -Command `"& '$NodeExe' '$CheckScript' >> '$LogFile' 2>&1`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $psArgs

$triggerDaily = New-ScheduledTaskTrigger -Daily -At "20:00"
$triggerLogin = New-ScheduledTaskTrigger -AtLogOn

$settings = New-ScheduledTaskSettingsSet `
    -RunOnlyIfNetworkAvailable `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

Register-ScheduledTask `
    -TaskName "VaTrack Cookie Sync" `
    -Action $action `
    -Trigger $triggerDaily, $triggerLogin `
    -Settings $settings `
    -RunLevel Highest `
    -Force | Out-Null

Write-Host "  Task registered: runs daily at 10AM + on login" -ForegroundColor Green

# ── Chrome shortcuts (add --remote-debugging-port=9222) ──────────────────────
$shortcuts = @(
    "$env:USERPROFILE\Desktop\Google Chrome.lnk",
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Google Chrome.lnk",
    "$env:PROGRAMDATA\Microsoft\Windows\Start Menu\Programs\Google Chrome.lnk"
)

$shell   = New-Object -ComObject WScript.Shell
$patched = 0
foreach ($sc in $shortcuts) {
    if (-not (Test-Path $sc)) { continue }
    $lnk = $shell.CreateShortcut($sc)
    if ($lnk.Arguments -notlike "*remote-debugging-port*") {
        $lnk.Arguments = ($lnk.Arguments + " --remote-debugging-port=9222").Trim()
        $lnk.Save()
        Write-Host "  Patched shortcut: $sc" -ForegroundColor Green
        $patched++
    } else {
        Write-Host "  Already patched: $sc"
    }
}
if ($patched -eq 0 -and -not ($shortcuts | Where-Object { Test-Path $_ })) {
    Write-Host "  Chrome shortcuts not found. Manually add --remote-debugging-port=9222 to your Chrome shortcut." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done. Restart Chrome once to activate the debug port." -ForegroundColor Cyan
Write-Host "Sync log: $LogFile"
