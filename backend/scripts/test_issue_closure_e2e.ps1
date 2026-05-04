# End-to-end: letter -> assign -> consultant work -> review -> final comment -> close -> history
# Uses isolated SQLite DB and port 8005 (set $Port / $DbName to override).
param(
    [int]$Port = 8005,
    [string]$DbName = "office_letters_closure_e2e.db"
)

$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:$Port/api/v1"
$env:PYTHONPATH = "."
$env:DATABASE_URL = "sqlite:///./$DbName"

Push-Location $PSScriptRoot\..
$dbPath = Join-Path (Get-Location) $DbName
if (Test-Path $dbPath) { Remove-Item $dbPath -Force -ErrorAction SilentlyContinue }
python scripts/seed_user.py | Out-Host

$job = Start-Job -ScriptBlock {
    param($root, $dbUrl, $listenPort)
    Set-Location $root
    $env:PYTHONPATH = "."
    $env:DATABASE_URL = $dbUrl
    python -m uvicorn app.main:app --host 127.0.0.1 --port $listenPort
} -ArgumentList (Get-Location).Path, $env:DATABASE_URL, $Port

Start-Sleep -Seconds 4

try {
    $admin = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType "application/x-www-form-urlencoded" -Body "username=admin@example.com&password=Admin@123"
    $adminToken = $admin.access_token

    $teamLead = @{ email = "closure-lead@example.com"; full_name = "Closure Lead"; password = "Lead@12345"; role_ids = @(4); department_id = 1; status = "active" } | ConvertTo-Json
    $consult = @{ email = "closure-consult@example.com"; full_name = "Closure Consult"; password = "Consult@123"; role_ids = @(5); department_id = 1; status = "active" } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "$base/users" -Headers @{ Authorization = "Bearer $adminToken" } -ContentType "application/json" -Body $teamLead | Out-Null
    Invoke-RestMethod -Method Post -Uri "$base/users" -Headers @{ Authorization = "Bearer $adminToken" } -ContentType "application/json" -Body $consult | Out-Null

    $leadLogin = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType "application/x-www-form-urlencoded" -Body "username=closure-lead@example.com&password=Lead@12345"
    $leadToken = $leadLogin.access_token

    if (-not (Test-Path "sample.pdf")) {
        [IO.File]::WriteAllBytes("sample.pdf", [Text.Encoding]::ASCII.GetBytes("%PDF-1.4`n%%EOF`n"))
    }

    $letterJson = curl.exe -s -X POST "$base/letters" -H "Authorization: Bearer $leadToken" -F "subject=Issue closure E2E" -F "received_from=Test Unit" -F "department_id=1" -F "priority=normal" -F "file=@sample.pdf;type=application/pdf"
    $letterId = ($letterJson | ConvertFrom-Json).id

    $consultRow = python -c "from app.db.session import SessionLocal; from app.models.user import User; from app.models.role import Role; from app.models.letter import Letter; from app.models.department import Department; from sqlalchemy import select; db=SessionLocal(); print(db.scalar(select(User.id).where(User.email=='closure-consult@example.com'))); db.close()"
    $deadline = (Get-Date).AddDays(5).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $assignBody = (@{ consultant_id = [int]$consultRow; deadline_at = $deadline; comment = "Assign for closure test" } | ConvertTo-Json)
    $assign = Invoke-RestMethod -Method Post -Uri "$base/assignments/letters/$letterId/assign" -Headers @{ Authorization = "Bearer $leadToken" } -ContentType "application/json" -Body $assignBody
    $aid = $assign.id

    $consultLogin = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType "application/x-www-form-urlencoded" -Body "username=closure-consult@example.com&password=Consult@123"
    $consultToken = $consultLogin.access_token

    $st = @{ work_status = "resolved"; comment = "Work completed for closure" } | ConvertTo-Json
    Invoke-RestMethod -Method Patch -Uri "$base/consultant/assignments/$aid/status" -Headers @{ Authorization = "Bearer $consultToken" } -ContentType "application/json" -Body $st | Out-Null

    $note = @{ resolution_note = "Verified fix applied to process."; comment = "Resolution note" } | ConvertTo-Json
    Invoke-RestMethod -Method Patch -Uri "$base/consultant/assignments/$aid/resolution" -Headers @{ Authorization = "Bearer $consultToken" } -ContentType "application/json" -Body $note | Out-Null

    curl.exe -s -X POST "$base/consultant/assignments/$aid/files" -H "Authorization: Bearer $consultToken" -F "comment=Solution PDF attached" -F "file=@sample.pdf;type=application/pdf" | Out-Null

    $review = @{ review_comment = "Solution reviewed and acceptable for closure." } | ConvertTo-Json
    $afterReview = Invoke-RestMethod -Method Post -Uri "$base/closure/letters/$letterId/review-solution" -Headers @{ Authorization = "Bearer $leadToken" } -ContentType "application/json" -Body $review

    $fc = @{ comment = "Stakeholders notified." } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "$base/closure/letters/$letterId/final-comment" -Headers @{ Authorization = "Bearer $leadToken" } -ContentType "application/json" -Body $fc | Out-Null

    $closeBody = @{ final_comment = "Officially closing after QA sign-off." } | ConvertTo-Json
    $closed = Invoke-RestMethod -Method Post -Uri "$base/closure/letters/$letterId/close" -Headers @{ Authorization = "Bearer $leadToken" } -ContentType "application/json" -Body $closeBody

    $hist = Invoke-RestMethod -Method Get -Uri "$base/closure/letters/$letterId/history" -Headers @{ Authorization = "Bearer $leadToken" }

    $types = ($hist.actions | ForEach-Object { $_.action }) -join ","
    Write-Host "LETTER_ID=$letterId CLOSED_STATUS=$($closed.status) CLOSED_AT=$($closed.closed_at)"
    Write-Host "HISTORY_ACTIONS=$types"

    if ($closed.status -ne "closed") { throw "Expected letter status closed" }
    if ($types -notmatch "review_solution") { throw "Missing review_solution in history" }
    if ($types -notmatch "close_issue") { throw "Missing close_issue in history" }
    Write-Host "E2E_ISSUE_CLOSURE_OK"
}
finally {
    Stop-Job $job -ErrorAction SilentlyContinue | Out-Null
    Remove-Job $job -Force -ErrorAction SilentlyContinue | Out-Null
}
Pop-Location
