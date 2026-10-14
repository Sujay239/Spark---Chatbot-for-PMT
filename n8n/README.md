# n8n Telemetry & Data Integration Workflow

This directory contains the production-ready **n8n Workflow** that powers the real-time **Overview & Telemetry Dashboard** in the PMT Spark Admin Portal (`overview.html`).

---

## 1. Files in this Directory

| File | Description |
| :--- | :--- |
| [`spark-overview-telemetry.json`](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/n8n/spark-overview-telemetry.json) | Full n8n workflow export for the Overview dashboard (`overview.html`). |
| [`spark-session-logs-telemetry.json`](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/n8n/spark-session-logs-telemetry.json) | Dedicated real-time dynamic session logs workflow for Session Telemetry Ledger (`session-logs.html`). |
| [`spark-token-usage-telemetry.json`](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/n8n/spark-token-usage-telemetry.json) | High-performance PostgreSQL-driven monthly token usage workflow with future month prevention and server load optimization (`token-usage.html`). |
| [`test-webhook.ps1`](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/n8n/test-webhook.ps1) | PowerShell test suite validating Overview Webhook (200 OK & 401 Unauthorized), CORS preflight, and JSON schema. |
| [`test-session-logs-webhook.ps1`](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/n8n/test-session-logs-webhook.ps1) | PowerShell test suite validating Session Logs Webhook (200 OK & 401 Unauthorized) and full session payload. |
| [`test-token-usage-webhook.ps1`](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/n8n/test-token-usage-webhook.ps1) | PowerShell test suite validating Token Usage Webhook (200 OK, 401 Unauthorized, monthly queries & fleet query). |
| [`README.md`](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/n8n/README.md) | Technical architecture, authentication, and endpoint documentation. |

---

## 2. Workflows Architecture

### A. Overview Dashboard Workflow (`spark-overview-telemetry.json`)
- **Webhook Endpoint**: `https://n8n.srv917960.hstgr.cloud/webhook/spark-overview-v2`
- **Tables Queried**: `predefined_questions`, `chat_memory`, `contact_requests`, `token_usage`
- **Output**: Aggregated KPI ribbon, 7D/30D trends, categories breakdown, recent 8 chat sessions, support requests.

### B. Session Logs Dynamic Ledger Workflow (`spark-session-logs-telemetry.json`)
- **Webhook Endpoint**: `https://n8n.srv917960.hstgr.cloud/webhook/spark-session-logs`
- **Tables Queried**: `chat_sessions`, `chat_memory`
- **Output**:
  - Top 4 KPI Metrics: Avg duration, total sessions, IP locations tracked, total messages count.
  - Complete sessions list with parsed IP/geo, device/browser user agent, duration, first question, and complete dialogue turns (`[USER]` and `[BOT]`).
  - Supports live streaming, search filtering, and drawer previews.

### C. Token Usage Telemetry Workflow (`spark-token-usage-telemetry.json`)
- **Webhook Endpoint**: `https://n8n.srv917960.hstgr.cloud/webhook/spark-token-usage`
- **Database Engine**: Direct PostgreSQL Node (`n8n-nodes-base.postgres`) connected to Supabase (`fyxl43WRvTWVDiig`).
- **Load Optimization**: Executes parameterized date range SQL query (`WHERE created_at >= 'YYYY-MM-01' AND created_at < 'YYYY-MM-01' + INTERVAL '1 month'`) to pull strictly the selected month's records, eliminating full-table loads unless the user explicitly chooses `all`.
- **Future Month Prevention**: Strictly clamps any request with future date stamps to the current UTC month.
- **Output**:
  - Live 4 KPI Ribbon: Total Tokens, Prompt Tokens (% share), Completion Tokens (% share), and Cached Tokens.
  - Interactive Tier Donut Chart: Default vs. Metadata Generation tier split.
  - Token Usage Over Time: Day-by-day / hour-by-hour prompt, cached, and completion token trends.
  - Raw Model Breakdown: Per-model raw token aggregates (prompt, cached, completion, total).
  - Recent Token Audit Logs: Paginated 10-per-page token audit trail with cached tokens.
  - **Zero Backend Pricing Overhead**: All pricing rate cards, USD/INR conversions, and cost shares are computed directly in the frontend (`token-usage.html`), eliminating n8n execution latency and enabling instant rate updates without touching backend workflows.

---

## 3. Webhook Endpoint Details

- **Host**: `https://n8n.srv917960.hstgr.cloud`
- **Endpoints**:
  - `POST` / `GET` `/webhook/spark-overview-v2`
  - `POST` / `GET` `/webhook/spark-session-logs`
  - `POST` / `GET` `/webhook/spark-token-usage?month=YYYY-MM` (or `?month=all`)
- **Authentication**: Bearer Token or `x-api-key` header (requires authenticated admin session token).
- **CORS**: Fully enabled (`Access-Control-Allow-Origin: *`, `GET, POST, OPTIONS`).

---

## 4. How to Import and Activate in n8n

1. Log into your n8n workspace at `https://n8n.srv917960.hstgr.cloud/`.
2. Click **Add Workflow** > **Import from File...**
3. Select [`spark-session-logs-telemetry.json`](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/n8n/spark-session-logs-telemetry.json) (or `spark-overview-telemetry.json`).
4. Verify the Supabase credential `Spark - PMT chatbot` (`id: 8E6XCbspLrdJ6Wus`) is selected on the Supabase nodes.
5. Click **Save** and toggle the workflow **Active**.
6. Run the test script in PowerShell:
   ```powershell
   .\n8n\test-session-logs-webhook.ps1
   ```
- **Path**: `/webhook/spark-overview` (or `/webhook-test/spark-overview` in test mode)
- **Supported Methods**: `POST`, `GET`, `OPTIONS`
- **CORS Support**: `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`, `Access-Control-Allow-Headers: Authorization, Content-Type, x-api-key, x-auth-token`

### Authentication Header
Every request from the admin portal must supply the session token received upon login:
```http
Authorization: Bearer <authToken>
```
*(Query param `?token=<authToken>` and header `x-api-key: <authToken>` are also accepted).*

---

## 4. Response Payload Schema

When authenticated successfully (HTTP 200):
```json
{
  "success": true,
  "status": 200,
  "timestamp": "2026-10-12T13:45:00.000Z",
  "kpi": {
    "total_predefined_questions": 113,
    "questions_growth": "+14.5%",
    "clinical_coverage": "98.4%",
    "active_sessions": 1466,
    "sessions_growth": "+8.2%",
    "avg_session_duration": "3m 28s",
    "concurrency_load": "Optimal (24%)",
    "support_submissions": 2,
    "urgent_tickets": 0,
    "response_sla": "4.2m",
    "escalation_status": "Within Bounds",
    "resolution_rate": "94.2%",
    "resolution_growth": "+2.4%",
    "hallucination_index": "< 0.01%",
    "total_tokens": "5.8M",
    "total_tokens_raw": 5826643
  },
  "telemetry": {
    "peak_load_window": "14:00 - 18:00 EST",
    "error_rate": "0.04% Tolerant",
    "token_throughput": "142k / hr",
    "patient_satisfaction": "92% Positive",
    "uptime": "99.98%",
    "system_status": "Spark Core Online",
    "diagnostic_node": "Node-East US • Cluster-4A",
    "latency": "14ms"
  },
  "trends": {
    "seven_days": [
      { "date": "2026-10-06", "weekday": "Tue", "label": "Oct 6", "inquiries": 18, "autoResolved": 17 },
      ...
    ],
    "thirty_days": [ ... ]
  },
  "top_categories": [
    { "name": "Treatment & Pain Relief", "count": 22, "percentage": 35, "description": "Clinical protocols, sciatica & chronic relief" },
    { "name": "Troubleshooting Ultima 5", "count": 19, "percentage": 28, "description": "Modes, troubleshooting & battery power" },
    { "name": "Using Your Ultima 5", "count": 14, "percentage": 21, "description": "Modes, troubleshooting & battery power" },
    { "name": "Electrode Pads & Accessories", "count": 11, "percentage": 16, "description": "Electrode placement, adhesion & care" }
  ],
  "recent_sessions": [
    {
      "sessionId": "spark_5g1s81pvd_1791619026213",
      "displayId": "#SPK-207E",
      "snippet": "can you explain how the nerve spa knee or knee pro therapy sessions are typically used for knee osteoarthritis or rheumatoid joint pain",
      "category": "Joint Therapy",
      "intent": "Clinical Consultation",
      "duration": "3m 28s",
      "status": "Resolved",
      "timestamp": "2 mins ago",
      "rawTimestamp": "2026-10-10T08:00:40.641Z",
      "messageCount": 5
    }
  ],
  "sidebar_counts": {
    "chat_sessions": "1.5k",
    "support_tickets": "2 pending",
    "questions_kb": "113"
  }
}
```

### Error Responses
**Missing / Invalid Token (HTTP 401)**:
```json
{
  "success": false,
  "status": 401,
  "error": "Unauthorized",
  "message": "Authentication failed: Missing or invalid authorization token. Access denied."
}
```

---

## 5. How to Import and Activate in n8n

1. Log into your n8n workspace at `https://n8n.srv917960.hstgr.cloud/`.
2. Click **Add Workflow** > **Import from File...**
3. Select [`spark-overview-telemetry.json`](file:///d:/Z_work/Sujay/Spark%20-%20PMT%20chatbot/n8n/spark-overview-telemetry.json).
4. Verify the Supabase credential `Spark - PMT chatbot` (`id: 8E6XCbspLrdJ6Wus`) is selected on the 4 Supabase nodes.
5. Click **Save** and toggle the workflow **Active**.
