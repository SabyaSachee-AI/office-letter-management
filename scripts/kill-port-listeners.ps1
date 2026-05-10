param(
    [int] $Port = 8000
)
$ErrorActionPreference = "Continue"
Write-Host "Checking TCP port $Port (LISTEN) ..."

$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listeners) {
    Write-Host "Nothing is listening on port $Port."
    exit 0
}

$pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($processId in $pids) {
    $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "Stopping $($proc.ProcessName) (PID $processId) ..."
        Stop-Process -Id $processId -Force
        taskkill /F /PID $processId /T 2>$null | Out-Null
    }
    else {
        Write-Warning @"
PID $processId appears in Get-NetTCPConnection but Get-Process cannot see it.
Common causes: WSL2 localhost forwarding, Hyper-V, or a zombie socket after a crashed uvicorn.

Try in order:
  1) If you use WSL:  wsl --shutdown   (reopens fresh; closes all Linux sessions)
  2) Reboot Windows (clears stuck bindings)
  3) Run the API on port 8001 instead (see "Quick workaround" printed below)
"@
        Write-Host ""
        Write-Host "=== Quick workaround (recommended) ===" -ForegroundColor Cyan
        Write-Host '  frontend/.env.local  ->  API_PROXY_TARGET=http://127.0.0.1:8001'
        Write-Host "  backend folder:"
        Write-Host "    python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001"
        Write-Host "  Then restart:  npm run dev"
        Write-Host ""
    }
}

Start-Sleep -Seconds 1
$still = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($still) {
    Write-Warning "Port $Port still shows LISTEN. See warnings above."
    netstat -ano | findstr ":$Port"
    Write-Host "If the PID cannot be killed, use port 8001 for the API + API_PROXY_TARGET (see script output above)." -ForegroundColor Yellow
    exit 1
}

Write-Host "Port $Port is free."
exit 0
