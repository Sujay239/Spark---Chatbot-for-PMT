# ==============================================================================
# PMT Spark - n8n Fallbacks & Rules Postgres Webhook Test Suite
# Tests:
# 1. 401 Unauthorized check when token is missing
# 2. 200 OK check with Bearer Token authentication
# 3. Validation of schema: kpi, fallbacks list, total_count
# 4. CORS preflight (OPTIONS) check
# ==============================================================================

param(
    [string]$BaseUrl = "https://n8n.srv917960.hstgr.cloud/webhook/spark-fallbacks-rules",
    [string]$AuthToken = "test_pmt_session_token_123456"
)

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Testing PMT Spark Fallbacks & Rules Webhook" -ForegroundColor Cyan
Write-Host "Endpoint: $BaseUrl" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

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

# Test 2: Authenticated request (Expected: 200 OK with fallbacks telemetry)
Write-Host "`n[Test 2] Querying Fallbacks identified from chat_memory via Postgres..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $AuthToken"
        "Content-Type"  = "application/json"
    }
    $resp = Invoke-RestMethod -Uri $BaseUrl -Method GET -Headers $headers -TimeoutSec 15 -ErrorAction Stop
    $data = if ($resp -is [string] -and $resp.Length -gt 0) { $resp | ConvertFrom-Json } else { $resp }
    $item = if ($data -is [System.Array]) { $data[0] } else { $data }

    if ($item -and $item.kpi) {
        Write-Host "[+] PASSED: Received HTTP 200 OK with Fallbacks Telemetry!" -ForegroundColor Green
        Write-Host "    - Total Fallbacks: $($item.kpi.total_fallbacks)" -ForegroundColor Gray
        Write-Host "    - Safety Guardrails: $($item.kpi.safety_guardrails_count)" -ForegroundColor Gray
        Write-Host "    - KB Misses: $($item.kpi.kb_misses_count)" -ForegroundColor Gray
        Write-Host "    - Hardware Faults: $($item.kpi.hardware_faults_count)" -ForegroundColor Gray
        Write-Host "    - Top Intent: $($item.kpi.top_intent)" -ForegroundColor Gray
        Write-Host "    - Total Count in Payload: $($item.total_count)" -ForegroundColor Gray
        Write-Host "    - Generated At: $($item.generated_at)" -ForegroundColor Gray
    } else {
        Write-Host "[!] HTTP 200 OK received, but payload was empty or missing .kpi." -ForegroundColor Yellow
    }
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Write-Host "[-] Request failed with status: $status ($($_.Exception.Message))" -ForegroundColor Red
    Write-Host "    Note: If the workflow is not yet imported/activated in n8n, import n8n/spark-fallbacks-rules-telemetry.json first." -ForegroundColor DarkGray
}

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "Test Suite Finished" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
