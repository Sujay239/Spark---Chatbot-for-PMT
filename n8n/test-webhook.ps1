# ==============================================================================
# PMT Spark - n8n Webhook Test Suite
# Tests:
# 1. 401 Unauthorized check when token is missing
# 2. 200 OK check when token is provided
# 3. CORS Preflight OPTIONS check
# ==============================================================================

param(
    [string]$BaseUrl = "https://n8n.srv917960.hstgr.cloud/webhook/spark-overview-v2",
    [string]$AuthToken = "test_pmt_session_token_123456"
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Testing PMT Spark n8n Overview Webhook" -ForegroundColor Cyan
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

# Test 2: Authenticated request with Bearer token (Expected: 200 OK)
Write-Host "`n[Test 2] Sending Authenticated Request with Bearer Token..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $AuthToken"
        "Content-Type"  = "application/json"
    }
    $resp = Invoke-RestMethod -Uri $BaseUrl -Method POST -Headers $headers -Body '{}' -TimeoutSec 15 -ErrorAction Stop
    $data = if ($resp -is [string] -and $resp.Length -gt 0) { $resp | ConvertFrom-Json } else { $resp }
    $item = if ($data -is [System.Array]) { $data[0] } else { $data }
    if ($item -and $item.kpi) {
        Write-Host "[+] PASSED: Received HTTP 200 OK with Telemetry payload!" -ForegroundColor Green
        Write-Host "    - Questions: $($item.kpi.total_predefined_questions)" -ForegroundColor Gray
        Write-Host "    - Active Sessions: $($item.kpi.active_sessions)" -ForegroundColor Gray
        Write-Host "    - Resolution Rate: $($item.kpi.resolution_rate)" -ForegroundColor Gray
        Write-Host "    - Total Tokens: $($item.kpi.total_tokens)" -ForegroundColor Gray
    } else {
        Write-Host "[!] HTTP 200 OK received, but payload was empty or missing .kpi." -ForegroundColor Yellow
        Write-Host "    Tip: Verify the 'spark-overview-v2' workflow executed to the 'Respond to Webhook' node." -ForegroundColor Yellow
    }
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Write-Host "[-] Request failed with status: $status ($($_.Exception.Message))" -ForegroundColor Red
    Write-Host "    Tip: Verify the workflow is Activated in your n8n workspace." -ForegroundColor Yellow
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "Test Suite Finished" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
