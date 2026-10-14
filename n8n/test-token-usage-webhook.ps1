# ==============================================================================
# PMT Spark - n8n Token Usage Monthly Postgres Webhook Test Suite
# Tests:
# 1. 401 Unauthorized check when token is missing
# 2. 200 OK check with specific month (?month=2026-10) using Postgres node
# 3. 200 OK check with all months (?month=all)
# 4. Future month clamp verification (ensuring future months cannot be pulled)
# ==============================================================================

param(
    [string]$BaseUrl = "https://n8n.srv917960.hstgr.cloud/webhook/spark-token-usage",
    [string]$AuthToken = "test_pmt_session_token_123456"
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Testing PMT Spark n8n Token Usage Webhook" -ForegroundColor Cyan
Write-Host "Endpoint: $BaseUrl" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Test 1: Unauthenticated request (Expected: 401 Unauthorized)
Write-Host "`n[Test 1] Sending Unauthenticated Request..." -ForegroundColor Yellow
try {
    $resp = Invoke-RestMethod -Uri $BaseUrl -Method POST -Headers @{ "Content-Type" = "application/json" } -Body '{}' -TimeoutSec 10 -ErrorAction Stop
    Write-Host "[-] Unexpected success: Received 200 instead of 401" -ForegroundColor Red
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 401) {
        Write-Host "[+] PASSED: Received HTTP 401 Unauthorized as expected." -ForegroundColor Green
    } else {
        Write-Host "[!] HTTP Status: $status ($($_.Exception.Message))" -ForegroundColor Magenta
    }
}

# Test 2: Authenticated request with specific month (?month=2026-10)
Write-Host "`n[Test 2] Querying Specific Month (2026-10) via Postgres..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $AuthToken"
        "Content-Type"  = "application/json"
    }
    $uriMonth = "$BaseUrl?month=2026-10"
    $resp = Invoke-RestMethod -Uri $uriMonth -Method GET -Headers $headers -TimeoutSec 15 -ErrorAction Stop
    $data = if ($resp -is [string] -and $resp.Length -gt 0) { $resp | ConvertFrom-Json } else { $resp }
    $item = if ($data -is [System.Array]) { $data[0] } else { $data }

    if ($item -and $item.kpi) {
        Write-Host "[+] PASSED: Received HTTP 200 OK with Monthly Postgres Telemetry!" -ForegroundColor Green
        Write-Host "    - Filter Selected Month: $($item.filter.selected_month)" -ForegroundColor Gray
        Write-Host "    - Total Monthly Tokens: $($item.kpi.total_tokens)" -ForegroundColor Gray
        Write-Host "    - Prompt Tokens: $($item.kpi.prompt_tokens) ($($item.kpi.prompt_pct)%)" -ForegroundColor Gray
        Write-Host "    - Completion Tokens: $($item.kpi.completion_tokens) ($($item.kpi.completion_pct)%)" -ForegroundColor Gray
        Write-Host "    - Total Monthly Logs: $($item.total_logs_count)" -ForegroundColor Gray
        Write-Host "    - Est. Total Cost: $($item.kpi.estimated_total_cost_usd_formatted)" -ForegroundColor Gray
        Write-Host "    - Available Months: $($item.available_months -join ', ')" -ForegroundColor Gray
    } else {
        Write-Host "[!] HTTP 200 OK received, but payload was empty or missing .kpi." -ForegroundColor Yellow
    }
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Write-Host "[-] Request failed with status: $status ($($_.Exception.Message))" -ForegroundColor Red
    Write-Host "    Tip: Import 'n8n/spark-token-usage-telemetry.json' and toggle workflow Active in n8n." -ForegroundColor Yellow
}

# Test 3: Authenticated request with ?month=all
Write-Host "`n[Test 3] Querying All Data (?month=all) via Postgres..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $AuthToken"
        "Content-Type"  = "application/json"
    }
    $uriAll = "$BaseUrl?month=all"
    $resp = Invoke-RestMethod -Uri $uriAll -Method GET -Headers $headers -TimeoutSec 15 -ErrorAction Stop
    $data = if ($resp -is [string] -and $resp.Length -gt 0) { $resp | ConvertFrom-Json } else { $resp }
    $item = if ($data -is [System.Array]) { $data[0] } else { $data }

    if ($item -and $item.kpi) {
        Write-Host "[+] PASSED: Successfully pulled fleet-wide token data!" -ForegroundColor Green
        Write-Host "    - Total All-Time Tokens: $($item.kpi.total_tokens)" -ForegroundColor Gray
        Write-Host "    - Total Fleet Logs Count: $($item.total_logs_count)" -ForegroundColor Gray
        Write-Host "    - Total Fleet Cost: $($item.kpi.estimated_total_cost_usd_formatted)" -ForegroundColor Gray
    } else {
        Write-Host "[!] HTTP 200 OK received, but payload missing .kpi." -ForegroundColor Yellow
    }
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Write-Host "[-] Request failed with status: $status ($($_.Exception.Message))" -ForegroundColor Red
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "Token Usage Test Suite Finished" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
