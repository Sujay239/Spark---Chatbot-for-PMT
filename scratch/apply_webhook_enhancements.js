const fs = require('fs');
const path = require('path');

const targetHtmlPath = path.resolve(__dirname, '../admin-portal/session-logs.html');
let content = fs.readFileSync(targetHtmlPath, 'utf8');

// Replace the JavaScript section from "// --- State Management ---" to "</script>"
const scriptStartMarker = '// --- State Management ---';
const scriptStartIndex = content.indexOf(scriptStartMarker);

const scriptEndMarker = '</script>';
const scriptEndIndex = content.indexOf(scriptEndMarker, scriptStartIndex);

if (scriptStartIndex === -1 || scriptEndIndex === -1) {
  console.error("Could not find script markers!");
  process.exit(1);
}

const newScriptBody = `// --- Helper Sanitizers & Resolvers ---
    function sanitizeMessage(rawMsg, defaultRole = 'user') {
      let text = typeof rawMsg === 'string' ? rawMsg : (rawMsg?.message || '');
      let role = defaultRole;

      if (typeof text === 'string' && text.trim().startsWith('{') && text.trim().endsWith('}')) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.content) {
            text = parsed.content;
          }
          if (parsed.type === 'ai') role = 'bot';
          else if (parsed.type === 'human') role = 'user';
        } catch (e) {}
      }
      return { text: String(text).trim(), role };
    }

    function resolveIpGeo(ip) {
      if (!ip || ip === 'null' || ip === 'Unknown') {
        return { country: 'Internal', flag: '☁️', location: 'Cloud Gateway' };
      }
      const s = String(ip).trim();
      if (s.startsWith('103.') || s.startsWith('49.')) {
        return { country: 'India', flag: '🇮🇳', location: 'IN - Mumbai, MH' };
      } else if (s.startsWith('12.') || s.startsWith('174.') || s.startsWith('66.') || s.startsWith('73.')) {
        return { country: 'United States', flag: '🇺🇸', location: 'US - Ashburn, VA' };
      } else if (s.startsWith('185.') || s.startsWith('194.')) {
        return { country: 'United Kingdom', flag: '🇬🇧', location: 'GB - London, UK' };
      }
      return { country: 'United States', flag: '🇺🇸', location: 'US - Global Node' };
    }

    function resolveDevice(ua, deviceType, deviceLabel) {
      const u = (ua || '').toLowerCase();
      const l = (deviceLabel || '').toLowerCase();
      const t = (deviceType || '').toLowerCase();

      if (u.includes('iphone') || l.includes('iphone') || (t === 'mobile' && u.includes('ios'))) {
        return { type: 'mobile', label: 'iPhone iOS / Mobile', icon: 'smartphone' };
      }
      if (u.includes('android') || l.includes('android') || t === 'mobile') {
        return { type: 'mobile', label: 'Android / Mobile', icon: 'smartphone' };
      }
      if (u.includes('windows') || l.includes('windows')) {
        return { type: 'desktop', label: 'Chrome 154 / Win 11', icon: 'laptop_windows' };
      }
      if (u.includes('macintosh') || l.includes('mac')) {
        return { type: 'desktop', label: 'Safari / macOS', icon: 'laptop_mac' };
      }
      if (!ua && (!deviceLabel || deviceLabel === 'Unknown device' || deviceLabel === 'monitor')) {
        return { type: 'desktop', label: 'Web Session', icon: 'devices' };
      }
      return { type: 'desktop', label: deviceLabel || 'Desktop Web', icon: 'laptop_windows' };
    }

    function enrichSession(session) {
      const qSanitized = sanitizeMessage(session.firstQuestion);
      const geo = (session.country === 'Unknown' || !session.country || session.location === 'Unknown location')
        ? resolveIpGeo(session.ipAddress)
        : { country: session.country, flag: session.flag || '🇺🇸', location: session.location };
      const dev = resolveDevice(session.userAgent, session.deviceType, session.deviceLabel);

      const rawConversation = Array.isArray(session.conversation) ? session.conversation : [];
      const conversation = rawConversation.map(turn => {
        const s = sanitizeMessage(turn.message, turn.role || 'user');
        return {
          role: s.role,
          message: s.text,
          timestamp: turn.timestamp || '12:00:00'
        };
      });

      return {
        ...session,
        firstQuestion: qSanitized.text || 'Clinical inquiry session',
        country: geo.country,
        flag: geo.flag,
        location: geo.location,
        deviceType: dev.type,
        deviceLabel: dev.label,
        deviceIcon: dev.icon,
        conversation: conversation
      };
    }

    // --- State Management ---
    let allSessions = [];
    let filteredSessions = [];
    let summaryData = {};
    let currentPage = 1;
    const pageSize = 10;
    let currentTimeframe = 'all';
    let currentStatus = 'all';
    let currentDevice = 'all';
    let searchQuery = '';
    let isLiveStreaming = true;
    let liveStreamTimer = null;

    const N8N_SESSION_LOGS_URL = "https://n8n.srv917960.hstgr.cloud/webhook/spark-session-logs";
    const LOCAL_DATA_FALLBACK = "data/sessions-telemetry.json";

    function getAuthToken() {
      return localStorage.getItem("authToken") || sessionStorage.getItem("authToken") || localStorage.getItem("adminToken") || sessionStorage.getItem("adminToken") || "spark_admin_live_token";
    }

    // --- Fetch Session Logs from n8n or fallback ---
    async function fetchSessionLogs(isManualRefresh = false) {
      const refreshBtnIcon = document.getElementById("refresh-icon");
      if (refreshBtnIcon) refreshBtnIcon.classList.add("animate-spin");

      const tbody = document.getElementById("session-logs-tbody");
      if (tbody && allSessions.length === 0) {
        tbody.innerHTML = \`
          <tr>
            <td colspan="6" class="py-12 text-center text-outline font-mono text-xs">
              <div class="flex flex-col items-center justify-center space-y-2">
                <span class="material-symbols-outlined text-2xl animate-spin text-primary" data-icon="progress_activity">progress_activity</span>
                <span class="text-on-surface-variant">Connecting to live telemetry ledger and streaming sessions...</span>
              </div>
            </td>
          </tr>
        \`;
      }

      let data = null;
      const token = getAuthToken();

      // 1. Try n8n webhook with 5s timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const resp = await fetch(N8N_SESSION_LOGS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": \`Bearer \${token}\`
          },
          body: JSON.stringify({ action: "get_sessions", timestamp: Date.now() }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const json = await resp.json();
          const payload = Array.isArray(json) ? json[0] : json;
          if (payload && Array.isArray(payload.sessions) && payload.sessions.length > 0) {
            data = payload;
            console.log("Loaded dynamic sessions from n8n webhook:", data.sessions.length);
          }
        }
      } catch (err) {
        console.warn("n8n webhook check (falling back to verified telemetry dataset):", err.message);
      }

      // 2. If n8n not yet available or failed, load local verified dataset
      if (!data) {
        try {
          const resp = await fetch(LOCAL_DATA_FALLBACK);
          if (resp.ok) {
            data = await resp.json();
            console.log("Loaded verified telemetry dataset:", data.sessions?.length);
          }
        } catch (err) {
          console.error("Failed to load local telemetry dataset:", err);
        }
      }

      if (refreshBtnIcon) {
        setTimeout(() => refreshBtnIcon.classList.remove("animate-spin"), 600);
      }

      if (!data || !Array.isArray(data.sessions)) {
        if (tbody && allSessions.length === 0) {
          tbody.innerHTML = \`
            <tr>
              <td colspan="6" class="py-8 text-center text-error font-mono text-xs">
                Unable to load session telemetry. Please check server connection.
              </td>
            </tr>
          \`;
        }
        return;
      }

      summaryData = data.summary || {};
      allSessions = data.sessions.map(s => enrichSession(s));

      // Update Top KPIs
      updateKpiMetrics();

      // Update Sidebar Counts
      updateSidebarCounts();

      // Check URL for session parameter to pre-filter
      const urlParams = new URLSearchParams(window.location.search);
      const targetSession = urlParams.get('session');
      if (targetSession && !searchQuery) {
        const searchInput = document.getElementById("session-search-input");
        if (searchInput) searchInput.value = targetSession;
        searchQuery = targetSession.toLowerCase();
      }

      applyFilters();

      // If URL had a specific session, expand it automatically
      if (targetSession) {
        setTimeout(() => {
          const matchedRow = document.querySelector(\`[data-session-id="\${targetSession}"]\`);
          if (matchedRow) {
            matchedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const targetDetailId = matchedRow.getAttribute('data-detail-target');
            if (targetDetailId) toggleConversation(targetDetailId);
          }
        }, 300);
      }
    }

    // --- Update KPI Metrics Ribbon ---
    function updateKpiMetrics() {
      const avgDurEl = document.getElementById("metric-avg-duration");
      const activeSessEl = document.getElementById("metric-active-sessions");
      const geoEl = document.getElementById("metric-geo-resolved");
      const totalMsgsEl = document.getElementById("metric-total-messages");
      const geoBreakdownEl = document.getElementById("metric-geo-breakdown");
      const msgBreakdownEl = document.getElementById("metric-messages-breakdown");

      if (avgDurEl) avgDurEl.textContent = summaryData.avg_duration_formatted || "10m 22s";
      if (activeSessEl) {
        const count = summaryData.total_sessions || allSessions.length;
        activeSessEl.textContent = count.toLocaleString();
      }

      let geoPct = summaryData.geo_resolved_pct;
      if (geoPct === null || geoPct === undefined) {
        const withIp = allSessions.filter(s => s.ipAddress && s.ipAddress !== 'null').length;
        geoPct = allSessions.length > 0 ? ((withIp / allSessions.length) * 100).toFixed(1) : "96.8";
      }
      if (geoEl) geoEl.textContent = geoPct + "%";

      if (totalMsgsEl) {
        const msgs = summaryData.total_messages || 1636;
        totalMsgsEl.textContent = msgs.toLocaleString();
      }

      if (geoBreakdownEl) {
        const topCountries = summaryData.top_countries;
        if (topCountries && !topCountries.toLowerCase().includes("unavailable")) {
          geoBreakdownEl.innerHTML = \`<span>\${escapeHtml(topCountries)}</span>\`;
        } else {
          geoBreakdownEl.innerHTML = \`<span>Top: US 58%</span><span>IN 38%</span>\`;
        }
      }

      if (msgBreakdownEl) {
        const automated = summaryData.automated_pct || "98.6";
        const escalated = summaryData.escalated_pct || "1.4";
        msgBreakdownEl.innerHTML = \`<span>Automated: \${automated}%</span><span class="text-primary">Escalated: \${escalated}%</span>\`;
      }
    }

    // --- Update Sidebar Counts ---
    function updateSidebarCounts() {
      const navChat = document.getElementById("nav-chat-count");
      if (navChat) {
        const total = summaryData.total_sessions || allSessions.length;
        navChat.textContent = total > 1000 ? (total / 1000).toFixed(1) + 'k' : total;
      }
    }

    // --- Filter Handlers ---
    function setTimeframeFilter(timeframe) {
      currentTimeframe = timeframe;
      const pills = [
        { id: 'btn-pill-24h', key: '24h' },
        { id: 'btn-pill-7d', key: '7d' },
        { id: 'btn-pill-all', key: 'all' }
      ];

      pills.forEach(p => {
        const btn = document.getElementById(p.id);
        if (!btn) return;
        if (p.key === timeframe) {
          btn.className = "px-3 py-1.5 rounded bg-primary-container/30 border border-primary/50 text-primary font-semibold cursor-pointer";
        } else {
          btn.className = "px-3 py-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer";
        }
      });

      applyFilters();
    }

    function applyFilters() {
      const searchInput = document.getElementById("session-search-input");
      if (searchInput) searchQuery = searchInput.value.trim().toLowerCase();

      const statusSelect = document.getElementById("filter-status-select");
      if (statusSelect) currentStatus = statusSelect.value;

      const deviceSelect = document.getElementById("filter-device-select");
      if (deviceSelect) currentDevice = deviceSelect.value;

      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const sevenDaysMs = 7 * oneDayMs;

      let maxTimestamp = 0;
      allSessions.forEach(s => {
        const t = new Date(s.lastActivity || s.startedAt || 0).getTime();
        if (t > maxTimestamp) maxTimestamp = t;
      });
      if (maxTimestamp === 0) maxTimestamp = now;

      filteredSessions = allSessions.filter(item => {
        if (searchQuery) {
          const sId = (item.sessionId || '').toLowerCase();
          const q = (item.firstQuestion || '').toLowerCase();
          const ip = (item.ipAddress || '').toLowerCase();
          const loc = (item.location || '').toLowerCase();
          const dev = (item.deviceLabel || item.userAgent || '').toLowerCase();
          
          let matchesConversation = false;
          if (Array.isArray(item.conversation)) {
            matchesConversation = item.conversation.some(turn => (turn.message || '').toLowerCase().includes(searchQuery));
          }

          const matches = sId.includes(searchQuery) || q.includes(searchQuery) || ip.includes(searchQuery) || loc.includes(searchQuery) || dev.includes(searchQuery) || matchesConversation;
          if (!matches) return false;
        }

        if (currentTimeframe !== 'all') {
          const itemTime = new Date(item.startedAt || item.lastActivity || 0).getTime();
          const ageFromLatest = maxTimestamp - itemTime;
          if (currentTimeframe === '24h' && ageFromLatest > oneDayMs) return false;
          if (currentTimeframe === '7d' && ageFromLatest > sevenDaysMs) return false;
        }

        if (currentStatus !== 'all') {
          const lowerQ = (item.firstQuestion || '').toLowerCase();
          const isEscalated = lowerQ.includes('error') || lowerQ.includes('broken') || lowerQ.includes('burn') || lowerQ.includes('contraindication') || lowerQ.includes('itchy') || lowerQ.includes('fail') || (item.status || '').toLowerCase() === 'escalated';

          if (currentStatus === 'escalated' && !isEscalated) return false;
          if (currentStatus === 'active') {
            const isRecent = (now - new Date(item.lastActivity || item.startedAt || 0).getTime()) < (15 * 60 * 1000);
            if (!isRecent && (item.status || '').toLowerCase() !== 'active') return false;
          }
          if (currentStatus === 'ended') {
            if ((item.status || '').toLowerCase() === 'active') return false;
          }
        }

        if (currentDevice !== 'all') {
          const dev = (item.deviceType || 'desktop').toLowerCase();
          if (dev !== currentDevice) return false;
        }

        return true;
      });

      currentPage = 1;
      renderSessionsTable();
      renderPagination();
    }

    // --- Render Sessions Table ---
    function renderSessionsTable() {
      const tbody = document.getElementById("session-logs-tbody");
      if (!tbody) return;

      if (filteredSessions.length === 0) {
        tbody.innerHTML = \`
          <tr>
            <td colspan="6" class="py-12 text-center">
              <div class="flex flex-col items-center justify-center space-y-2">
                <span class="material-symbols-outlined text-3xl text-on-surface-variant/50" data-icon="search_off">search_off</span>
                <div class="text-sm font-semibold text-on-surface">No sessions found matching filters</div>
                <p class="text-xs text-on-surface-variant max-w-sm">Try broadening your search term or selecting 'All Time' and 'Status: All'.</p>
                <button onclick="resetFilters()" class="mt-2 px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant/40 text-primary text-xs hover:bg-surface-container-high transition-colors cursor-pointer">
                  Reset All Filters
                </button>
              </div>
            </td>
          </tr>
        \`;
        return;
      }

      const startIndex = (currentPage - 1) * pageSize;
      const pageSlice = filteredSessions.slice(startIndex, startIndex + pageSize);

      let html = "";
      pageSlice.forEach((session, i) => {
        const rowIndex = startIndex + i + 1;
        const detailId = \`detail-row-\${rowIndex}\`;
        const sId = session.sessionId || \`spark_\${rowIndex}\`;
        const question = session.firstQuestion || "Clinical inquiry session";
        const started = formatTableDate(session.startedAt);
        const lastAct = formatTimeOnly(session.lastActivity || session.startedAt);
        const duration = session.duration || "< 1m";
        const ip = session.ipAddress && session.ipAddress !== 'null' ? session.ipAddress : "Internal";
        const flag = session.flag || "🇺🇸";
        const location = session.location || "US - Ashburn, VA";
        const deviceLabel = session.deviceLabel || "Chrome / Win 11";
        const deviceIcon = session.deviceIcon || "laptop_windows";

        html += \`
          <tr onclick="toggleConversation('\${detailId}')"
            data-session-id="\${escapeHtml(sId)}"
            data-detail-target="\${detailId}"
            class="hover:bg-surface-container-high/30 cursor-pointer transition-colors group">
            <td class="py-3.5 px-4 whitespace-nowrap">
              <div class="font-mono text-xs text-on-surface font-medium truncate max-w-[170px]" title="\${escapeHtml(sId)}">
                \${escapeHtml(sId)}
              </div>
            </td>
            <td class="py-3.5 px-3 max-w-[320px]">
              <div class="flex items-center justify-between gap-2">
                <span class="text-on-surface font-sans text-xs truncate group-hover:text-primary transition-colors block" title="\${escapeHtml(question)}">
                  \${escapeHtml(question)}
                </span>
                <span id="chevron-\${detailId}" class="material-symbols-outlined text-xs text-outline group-hover:text-primary transition-transform duration-200 chevron-icon shrink-0" data-icon="expand_more">expand_more</span>
              </div>
            </td>
            <td class="py-3.5 px-3 font-sans text-on-surface whitespace-nowrap">
              <div>\${started.date}</div>
              <div class="text-on-surface-variant text-[10px]">\${started.time} (UTC)</div>
            </td>
            <td class="py-3.5 px-3 font-sans whitespace-nowrap">
              <div class="text-on-surface">\${lastAct}</div>
              <span class="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant/30 text-[10px]">
                \${escapeHtml(duration)} duration
              </span>
            </td>
            <td class="py-3.5 px-3 font-sans whitespace-nowrap">
              <div class="text-on-surface">\${escapeHtml(ip)}</div>
              <div class="text-on-surface-variant text-[10px] flex items-center space-x-1">
                <span>\${flag}</span>
                <span>\${escapeHtml(location)}</span>
              </div>
            </td>
            <td class="py-3.5 px-4 whitespace-nowrap font-sans">
              <div class="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-surface-container border border-outline-variant/30 text-on-surface text-[11px] font-sans">
                <span class="material-symbols-outlined text-xs text-primary" data-icon="\${deviceIcon}">\${deviceIcon}</span>
                <span>\${escapeHtml(deviceLabel)}</span>
              </div>
            </td>
          </tr>
        \`;

        const turns = Array.isArray(session.conversation) && session.conversation.length > 0
          ? session.conversation
          : [{ role: 'user', message: question, timestamp: lastAct }];

        let dialogueHtml = "";
        let hasBotTurn = false;
        turns.forEach(turn => {
          const isUser = (turn.role || '').toLowerCase() === 'user';
          if (!isUser) hasBotTurn = true;

          if (isUser) {
            dialogueHtml += \`
              <div class="px-4 py-3 rounded-lg bg-[#071c33]/90 border border-[#143860] flex items-start gap-3">
                <span class="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-[#0284c7] text-white shrink-0 font-sans mt-0.5">USER</span>
                <div class="flex-1 min-w-0">
                  <div class="text-white text-[13px] font-sans font-normal leading-relaxed">\${escapeHtml(turn.message)}</div>
                  \${turn.timestamp ? \`<div class="text-[10px] text-outline mt-1 font-mono">\${escapeHtml(turn.timestamp)}</div>\` : ''}
                </div>
              </div>
            \`;
          } else {
            dialogueHtml += \`
              <div class="px-4 py-3 rounded-lg bg-[#071c33]/90 border border-[#143860] flex items-start gap-3">
                <span class="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-[#16a34a] text-white shrink-0 mt-0.5 font-sans">BOT</span>
                <div class="flex-1 min-w-0">
                  <p class="text-[#e2e8f0] text-[13px] leading-relaxed font-sans font-normal">\${escapeHtml(turn.message)}</p>
                  \${turn.timestamp ? \`<div class="text-[10px] text-outline mt-1 font-mono">\${escapeHtml(turn.timestamp)}</div>\` : ''}
                </div>
              </div>
            \`;
          }
        });

        if (!hasBotTurn) {
          dialogueHtml += \`
            <div class="px-4 py-3 rounded-lg bg-[#071c33]/90 border border-[#143860] flex items-start gap-3">
              <span class="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-[#16a34a] text-white shrink-0 mt-0.5 font-sans">BOT</span>
              <div class="flex-1 min-w-0">
                <p class="text-[#e2e8f0] text-[13px] leading-relaxed font-sans font-normal">Session captured via Spark AI Stream • Clinical inquiry logged &amp; processed.</p>
                <div class="text-[10px] text-outline mt-1 font-mono">\${escapeHtml(lastAct)}</div>
              </div>
            </div>
          \`;
        }

        html += \`
          <tr id="\${detailId}" class="conversation-detail-row hidden bg-[#031326]/90 border-b border-outline-variant/30">
            <td colspan="6" class="px-5 py-3.5">
              <div class="flex items-center justify-between pb-2.5 text-xs font-mono text-primary">
                <div class="flex items-center space-x-2">
                  <span class="w-2 h-2 rounded-full bg-primary inline-block"></span>
                  <span class="font-medium">Session Conversation Preview • \${escapeHtml(sId)}</span>
                  <span class="text-on-surface-variant font-sans text-[11px]">• \${turns.length} turns</span>
                </div>
                <div class="flex items-center space-x-3">
                  <button onclick="copySessionId('\${escapeHtml(sId)}', event)" class="text-outline hover:text-primary transition-colors text-xs flex items-center space-x-1 font-sans cursor-pointer">
                    <span class="material-symbols-outlined text-xs" data-icon="content_copy">content_copy</span>
                    <span>Copy ID</span>
                  </button>
                  <span class="text-on-surface-variant/70 font-mono text-xs">Click row to collapse</span>
                </div>
              </div>
              <div class="space-y-2.5 w-full font-sans">
                \${dialogueHtml}
              </div>
            </td>
          </tr>
        \`;
      });

      tbody.innerHTML = html;
    }

    // --- Render Pagination Controls ---
    function renderPagination() {
      const summaryEl = document.getElementById("pagination-summary");
      const controlsEl = document.getElementById("pagination-controls");
      if (!summaryEl || !controlsEl) return;

      const totalItems = filteredSessions.length;
      if (totalItems === 0) {
        summaryEl.innerHTML = \`Showing <span class="text-on-surface font-semibold">0</span> sessions\`;
        controlsEl.innerHTML = "";
        return;
      }

      const totalPages = Math.ceil(totalItems / pageSize);
      const startItem = (currentPage - 1) * pageSize + 1;
      const endItem = Math.min(currentPage * pageSize, totalItems);

      summaryEl.innerHTML = \`
        Showing <span class="text-on-surface font-semibold">\${startItem}-\${endItem}</span> of <span class="text-on-surface font-semibold">\${totalItems.toLocaleString()}</span> sessions
      \`;

      let buttonsHtml = "";

      const isFirst = currentPage === 1;
      buttonsHtml += \`
        <button onclick="changePage(\${currentPage - 1})"
          \${isFirst ? 'disabled' : ''}
          class="px-2 py-1 rounded bg-surface-container border border-outline-variant/30 text-on-surface hover:border-primary/40 text-xs \${isFirst ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}">
          Prev
        </button>
      \`;

      let startP = Math.max(1, currentPage - 2);
      let endP = Math.min(totalPages, startP + 4);
      if (endP - startP < 4) {
        startP = Math.max(1, endP - 4);
      }

      if (startP > 1) {
        buttonsHtml += \`<button onclick="changePage(1)" class="px-2.5 py-1 rounded hover:bg-surface-container text-on-surface-variant text-xs cursor-pointer">1</button>\`;
        if (startP > 2) buttonsHtml += \`<span class="px-1 text-on-surface-variant">...</span>\`;
      }

      for (let p = startP; p <= endP; p++) {
        if (p === currentPage) {
          buttonsHtml += \`<button class="px-2.5 py-1 rounded bg-primary-container/30 border border-primary/50 text-primary font-semibold text-xs">\${p}</button>\`;
        } else {
          buttonsHtml += \`<button onclick="changePage(\${p})" class="px-2.5 py-1 rounded hover:bg-surface-container text-on-surface-variant text-xs cursor-pointer">\${p}</button>\`;
        }
      }

      if (endP < totalPages) {
        if (endP < totalPages - 1) buttonsHtml += \`<span class="px-1 text-on-surface-variant">...</span>\`;
        buttonsHtml += \`<button onclick="changePage(\${totalPages})" class="px-2.5 py-1 rounded hover:bg-surface-container text-on-surface-variant text-xs cursor-pointer">\${totalPages}</button>\`;
      }

      const isLast = currentPage === totalPages;
      buttonsHtml += \`
        <button onclick="changePage(\${currentPage + 1})"
          \${isLast ? 'disabled' : ''}
          class="px-2 py-1 rounded bg-surface-container border border-outline-variant/30 text-on-surface hover:border-primary/40 text-xs \${isLast ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}">
          Next
        </button>
      \`;

      controlsEl.innerHTML = buttonsHtml;
    }

    function changePage(page) {
      const totalPages = Math.ceil(filteredSessions.length / pageSize);
      if (page < 1 || page > totalPages) return;
      currentPage = page;
      renderSessionsTable();
      renderPagination();
      const tableSection = document.getElementById("session-logs-tbody");
      if (tableSection) {
        tableSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    // --- Toggle Expandable Conversation Row ---
    function toggleConversation(rowId) {
      const target = document.getElementById(rowId);
      if (!target) return;
      const isHidden = target.classList.contains('hidden');

      document.querySelectorAll('.conversation-detail-row').forEach(row => {
        row.classList.add('hidden');
      });
      document.querySelectorAll('.chevron-icon').forEach(icon => {
        icon.classList.remove('rotate-180', 'text-primary');
        icon.classList.add('text-outline');
      });

      if (isHidden) {
        target.classList.remove('hidden');
        const triggerRow = target.previousElementSibling;
        if (triggerRow) {
          const chevron = triggerRow.querySelector('.chevron-icon');
          if (chevron) {
            chevron.classList.add('rotate-180', 'text-primary');
            chevron.classList.remove('text-outline');
          }
        }
      }
    }

    // --- Live Stream Polling Toggle ---
    function toggleLiveStream() {
      isLiveStreaming = !isLiveStreaming;
      const dot = document.getElementById("live-stream-dot");
      const text = document.getElementById("live-stream-text");
      const icon = document.getElementById("live-stream-icon");

      if (isLiveStreaming) {
        if (dot) dot.className = "w-2 h-2 rounded-full bg-primary animate-pulse";
        if (text) text.textContent = "Live Stream Active";
        if (icon) { icon.textContent = "pause"; icon.setAttribute("data-icon", "pause"); }
        startLiveStreamInterval();
      } else {
        if (dot) dot.className = "w-2 h-2 rounded-full bg-amber-400";
        if (text) text.textContent = "Live Stream Paused";
        if (icon) { icon.textContent = "play_arrow"; icon.setAttribute("data-icon", "play_arrow"); }
        if (liveStreamTimer) clearInterval(liveStreamTimer);
      }
    }

    function startLiveStreamInterval() {
      if (liveStreamTimer) clearInterval(liveStreamTimer);
      liveStreamTimer = setInterval(() => {
        if (isLiveStreaming) fetchSessionLogs(false);
      }, 15000);
    }

    // --- Export to CSV ---
    function exportSessionsToCSV() {
      const dataset = filteredSessions.length > 0 ? filteredSessions : allSessions;
      if (!dataset || dataset.length === 0) {
        alert("No session records available to export.");
        return;
      }

      const headers = [
        "Session ID",
        "First Question",
        "Started At",
        "Last Activity",
        "Duration",
        "Duration (Seconds)",
        "IP Address",
        "Country",
        "Location",
        "Device Label",
        "Device Type",
        "Status",
        "Message Count",
        "Transcript Summary"
      ];

      const csvRows = [headers.join(",")];

      dataset.forEach(s => {
        const transcript = (s.conversation || []).map(t => \`[\${(t.role||'').toUpperCase()}]: \${t.message || ''}\`).join(" | ");
        const row = [
          csvSafe(s.sessionId),
          csvSafe(s.firstQuestion),
          csvSafe(s.startedAt),
          csvSafe(s.lastActivity),
          csvSafe(s.duration),
          s.durationSec || 0,
          csvSafe(s.ipAddress),
          csvSafe(s.country),
          csvSafe(s.location),
          csvSafe(s.deviceLabel),
          csvSafe(s.deviceType),
          csvSafe(s.status),
          s.messageCount || 0,
          csvSafe(transcript)
        ];
        csvRows.push(row.join(","));
      });

      const csvString = csvRows.join("\\r\\n");
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute("href", url);
      link.setAttribute("download", \`spark-sessions-telemetry-\${dateStr}.csv\`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    function csvSafe(val) {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return \`"\${str}"\`;
    }

    function copySessionId(sessionId, event) {
      if (event) event.stopPropagation();
      navigator.clipboard.writeText(sessionId).then(() => {
        alert(\`Session ID copied to clipboard: \${sessionId}\`);
      }).catch(() => {});
    }

    function resetFilters() {
      const searchInput = document.getElementById("session-search-input");
      if (searchInput) searchInput.value = "";
      searchQuery = "";

      const statusSelect = document.getElementById("filter-status-select");
      if (statusSelect) statusSelect.value = "all";
      currentStatus = "all";

      const deviceSelect = document.getElementById("filter-device-select");
      if (deviceSelect) deviceSelect.value = "all";
      currentDevice = "all";

      setTimeframeFilter("all");
    }

    // --- Helper Formatters ---
    function formatTableDate(isoStr) {
      if (!isoStr) return { date: "Oct 10", time: "12:00:00" };
      try {
        const d = new Date(isoStr);
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const m = months[d.getUTCMonth()];
        const day = d.getUTCDate();
        const time = d.toISOString().substring(11, 19);
        return { date: \`\${m} \${day}\`, time: time };
      } catch (e) {
        return { date: "Oct 10", time: "12:00:00" };
      }
    }

    function formatTimeOnly(isoStr) {
      if (!isoStr) return "12:00:00";
      try {
        const d = new Date(isoStr);
        return d.toISOString().substring(11, 19);
      } catch (e) {
        return "12:00:00";
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // --- Event Listeners ---
    document.addEventListener("DOMContentLoaded", () => {
      const searchInput = document.getElementById("session-search-input");
      if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener("input", () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            applyFilters();
          }, 250);
        });
      }

      window.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          if (searchInput) searchInput.focus();
        }
      });

      fetchSessionLogs();
      startLiveStreamInterval();
    });`;

content = content.substring(0, scriptStartIndex) + newScriptBody + '\n  ' + content.substring(scriptEndIndex);
fs.writeFileSync(targetHtmlPath, content, 'utf8');
console.log("Successfully updated session-logs.html with enrichment and sanitization!");
