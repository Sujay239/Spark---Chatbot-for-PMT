# ==============================================================================
# PMT Spark - n8n Session Logs Webhook Test Suite
# Tests:
# 1. 401 Unauthorized check when token is missing
# 2. 200 OK check when token is provided, verifying real-time session telemetry
# ==============================================================================

param(
    [string]$BaseUrl = "https://n8n.srv917960.hstgr.cloud/webhook/spark-session-logs",
    [string]$AuthToken = "test_pmt_session_token_123456"
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Testing PMT Spark n8n Session Logs Webhook" -ForegroundColor Cyan
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
    if ($item -and $item.sessions) {
        Write-Host "[+] PASSED: Received HTTP 200 OK with Dynamic Session Telemetry!" -ForegroundColor Green
        Write-Host "    - Total Sessions Logged: $($item.summary.total_sessions)" -ForegroundColor Gray
        Write-Host "    - Total Messages: $($item.summary.total_messages)" -ForegroundColor Gray
        Write-Host "    - Avg Duration: $($item.summary.avg_duration_formatted)" -ForegroundColor Gray
        Write-Host "    - Sessions Array Count: $($item.sessions.Count)" -ForegroundColor Gray
        if ($item.sessions.Count -gt 0) {
            Write-Host "    - First Session ID: $($item.sessions[0].sessionId)" -ForegroundColor Gray
            Write-Host "    - First Question: $($item.sessions[0].firstQuestion)" -ForegroundColor Gray
            Write-Host "    - Duration: $($item.sessions[0].duration)" -ForegroundColor Gray
        }
    } else {
        Write-Host "[!] HTTP 200 OK received, but payload was empty or missing .sessions." -ForegroundColor Yellow
        Write-Host "    Tip: Verify the 'spark-session-logs' workflow executed to 'Respond 200 Session Logs' node." -ForegroundColor Yellow
    }
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Write-Host "[-] Request failed with status: $status ($($_.Exception.Message))" -ForegroundColor Red
    Write-Host "    Tip: Import 'n8n/spark-session-logs-telemetry.json' and Activate it in your n8n workspace." -ForegroundColor Yellow
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "Test Suite Finished" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
