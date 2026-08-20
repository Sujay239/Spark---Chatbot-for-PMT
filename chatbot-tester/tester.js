const fs = require('fs');
const readline = require('readline');
const crypto = require('crypto');
const { exec } = require('child_process');
const path = require('path');

// Setup
const inputCsv = process.argv[2] || 'sample_questions.csv';
const outputJson = 'test_report.json';
const outputHtml = 'test_report.html';

function isFallbackResponse(resp) {
    if (!resp) return true;
    let text = '';
    if (typeof resp === 'string') text = resp;
    else if (typeof resp === 'object') {
        text = resp.text || resp.output || resp.answer || resp.response || JSON.stringify(resp);
    }
    const lower = text.toLowerCase();
    return lower.includes("couldn't find a relevant answer") ||
           lower.includes("sorry, i couldn't find") ||
           (lower.includes("contact pmt support") && lower.includes("info@paintechnology.com"));
}

async function processQuestions() {
    if (!fs.existsSync(inputCsv)) {
        console.error(`Error: File ${inputCsv} not found. Please provide a valid file.`);
        console.log(`Usage: node tester.js <path_to_csv_or_json>`);
        process.exit(1);
    }

    const questions = [];
    const ext = path.extname(inputCsv).toLowerCase();

    if (ext === '.json') {
        const content = fs.readFileSync(inputCsv, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
            parsed.forEach((item) => {
                if (typeof item === 'string' && item.trim()) {
                    questions.push(item.trim());
                } else if (typeof item === 'object' && item !== null) {
                    const q = item.question || item.q || item.chatInput || item.prompt;
                    if (q) questions.push(String(q).trim());
                }
            });
        }
    } else {
        const fileStream = fs.createReadStream(inputCsv);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            if (line.trim()) {
                let raw = line.trim();
                if (raw.toLowerCase().startsWith('question') || raw.startsWith('VagueQuestion')) continue;
                
                let q = raw;
                if (raw.includes('","')) {
                    q = raw.split('","')[0].replace(/^"/, '').trim();
                } else if (raw.includes(',')) {
                    q = raw.split(',')[0].trim();
                }
                if (q.startsWith('"') && q.endsWith('"')) {
                    q = q.substring(1, q.length - 1).trim();
                }
                if (q) {
                    questions.push(q);
                }
            }
        }
    }

    console.log(`Found ${questions.length} questions in ${inputCsv}. Starting test...`);
    const results = [];

    for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        console.log(`\n[Question ${i + 1}/${questions.length}] Sending: "${question}"`);
        
        // Generate a UNIQUE session ID for each question
        const sessionId = 'test-' + crypto.randomBytes(4).toString('hex');
        
        const start = Date.now();
        let respData = null;
        let isSuccess = false;
        let err = null;

        try {
            const url = `https://n8n.srv917960.hstgr.cloud/webhook/spark-chatbot?chatInput=${encodeURIComponent(question)}&sessionId=${encodeURIComponent(sessionId)}&is_dev=true`;
            const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json, text/plain, */*' } });
            const text = await res.text();
            try { respData = JSON.parse(text); } catch(e) { respData = text; }
            
            const isFallback = isFallbackResponse(respData);
            if (res.ok && !isFallback) {
                isSuccess = true;
            } else {
                isSuccess = false;
                if (!res.ok) {
                    err = `HTTP Error ${res.status}`;
                } else if (isFallback) {
                    err = `Fallback Answer (No relevant answer found)`;
                }
            }
        } catch (error) { 
            err = error.message; 
        }
        const durationMs = Date.now() - start;

        const statusStr = isSuccess ? `SUCCESS (${durationMs}ms)` : `FAILED (${err})`;
        console.log(`-> Response: ${statusStr}`);

        results.push({
            id: i + 1,
            question: question,
            response: respData,
            durationMs: durationMs,
            success: isSuccess,
            error: err,
            sessionId: sessionId,
            timestamp: new Date().toISOString()
        });
        
        // Polite delay between queries
        await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Save JSON output
    fs.writeFileSync(outputJson, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\nSaved raw test results to ${outputJson}`);

    // Generate HTML report & open in browser
    generateHtmlReport(results);
}

function generateHtmlReport(results) {
    const processedResults = results.map(r => {
        const isFallback = isFallbackResponse(r.response);
        const success = r.success && !isFallback;
        const error = r.error || (isFallback ? "Fallback Answer (No relevant answer found)" : null);
        return { ...r, success, error };
    });

    const successCount = processedResults.filter(r => r.success).length;
    const failCount = processedResults.length - successCount;
    const avgDuration = processedResults.length > 0 ? (processedResults.reduce((acc, r) => acc + r.durationMs, 0) / processedResults.length).toFixed(0) : 0;
    
    // Format response objects or strings safely for UI display
    const formatResponse = (resp) => {
        if (resp === null || resp === undefined) return '<span style="color: #64748b;">No response</span>';
        if (typeof resp === 'string') return escapeHtml(resp);
        if (typeof resp === 'object') {
            const str = resp.output || resp.answer || resp.text || resp.response;
            if (typeof str === 'string') return escapeHtml(str);
            return escapeHtml(JSON.stringify(resp, null, 2));
        }
        return escapeHtml(String(resp));
    };

    const escapeHtml = (unsafe) => {
        return String(unsafe)
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    };

    const rows = processedResults.map(r => {
        const searchText = `${r.id} ${r.question} ${typeof r.response === 'object' ? (r.response.text || r.response.output || JSON.stringify(r.response)) : String(r.response)} ${r.error || ''}`;
        return `
        <tr data-status="${r.success ? 'passed' : 'failed'}" data-search="${escapeHtml(searchText)}" class="transition-all hover:bg-slate-800/50 group border-b border-slate-700/50">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400 align-top font-mono">#${r.id}</td>
            <td class="px-6 py-4 align-top">
                <div class="bg-slate-800/60 rounded-lg p-4 border border-slate-700/50 space-y-3">
                    <div>
                        <p class="text-xs font-semibold text-indigo-400 mb-1 uppercase tracking-wider">Question</p>
                        <p class="text-sm font-medium text-slate-200">${escapeHtml(r.question)}</p>
                    </div>
                    <div class="pl-3 border-l-2 ${r.success ? 'border-indigo-500/40' : 'border-rose-500/40'}">
                        <p class="text-xs text-slate-400 mb-1">Bot Answer (${r.durationMs}ms)</p>
                        <div class="text-sm text-slate-300 max-h-48 overflow-y-auto custom-scrollbar whitespace-pre-wrap font-sans">${formatResponse(r.response)}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 align-top">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${r.success ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20' : 'bg-rose-400/10 text-rose-400 border border-rose-400/20'}">
                    ${r.success ? 'Success' : 'Failed'}
                </span>
                ${r.error ? `<p class="mt-1.5 text-xs text-rose-400 font-medium">${escapeHtml(r.error)}</p>` : ''}
            </td>
            <td class="px-6 py-4 text-sm text-slate-400 whitespace-nowrap align-top font-mono">${r.durationMs} ms</td>
        </tr>
    `}).join('');

    const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chatbot Test Report</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                    },
                    colors: {
                        slate: {
                            850: '#151e2e',
                            900: '#0f172a',
                        }
                    }
                }
            }
        }
    </script>
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #0f172a; color: #f8fafc; }
        
        .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(30, 41, 59, 0.5); 
            border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(71, 85, 105, 0.8); 
            border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(100, 116, 139, 1); 
        }

        .glass-panel {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .glow-effect {
            box-shadow: 0 0 40px -10px rgba(99, 102, 241, 0.15);
        }
    </style>
</head>
<body class="antialiased min-h-screen bg-slate-900 selection:bg-indigo-500/30">
    <div class="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[120px]"></div>
        <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px]"></div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <!-- Header Section -->
        <header class="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <h1 class="text-3xl font-bold text-white tracking-tight">Chatbot Test Report</h1>
                </div>
                <p class="text-slate-400">Direct Question QA Evaluation Report</p>
            </div>
            
            <div class="flex gap-4 items-center">
                <p class="text-sm text-slate-400">Generated on ${new Date().toLocaleString()}</p>
            </div>
        </header>

        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <div class="glass-panel rounded-2xl p-6 glow-effect">
                <p class="text-sm font-medium text-slate-400 mb-1">Total Questions</p>
                <p class="text-3xl font-bold text-white">${processedResults.length}</p>
            </div>
            <div class="glass-panel rounded-2xl p-6 glow-effect border-l-2 border-l-emerald-500/50 cursor-pointer" onclick="filterStatus('passed')">
                <p class="text-sm font-medium text-emerald-400 mb-1">Successful Calls</p>
                <div class="flex items-baseline gap-2">
                    <p class="text-3xl font-bold text-white">${successCount}</p>
                    <p class="text-sm font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">${processedResults.length ? ((successCount/processedResults.length)*100).toFixed(1) : 0}%</p>
                </div>
            </div>
            <div class="glass-panel rounded-2xl p-6 glow-effect border-l-2 border-l-rose-500/50 cursor-pointer" onclick="filterStatus('failed')">
                <p class="text-sm font-medium text-rose-400 mb-1">Failed Calls</p>
                <div class="flex items-baseline gap-2">
                    <p class="text-3xl font-bold text-white">${failCount}</p>
                    <p class="text-sm font-medium text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-full">${processedResults.length ? ((failCount/processedResults.length)*100).toFixed(1) : 0}%</p>
                </div>
            </div>
            <div class="glass-panel rounded-2xl p-6 glow-effect border-l-2 border-l-blue-500/50">
                <p class="text-sm font-medium text-blue-400 mb-1">Avg Response Time</p>
                <div class="flex items-baseline gap-2">
                    <p class="text-3xl font-bold text-white">${avgDuration}</p>
                    <p class="text-sm font-medium text-slate-400">ms</p>
                </div>
            </div>
        </div>

        <!-- Toolbar Section (Filters & Search) -->
        <div class="glass-panel rounded-2xl p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-700/50">
            <!-- Filter Pills -->
            <div class="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                <button id="filter-btn-all" onclick="filterStatus('all')" class="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-md shadow-indigo-500/10 transition-all duration-200">
                    All (${processedResults.length})
                </button>
                <button id="filter-btn-passed" onclick="filterStatus('passed')" class="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-slate-700/50 transition-all duration-200">
                    Passed (${successCount})
                </button>
                <button id="filter-btn-failed" onclick="filterStatus('failed')" class="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-slate-700/50 transition-all duration-200">
                    Failed (${failCount})
                </button>
            </div>

            <!-- Search Input -->
            <div class="relative w-full md:w-80">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <input type="text" id="searchInput" oninput="applyFilters()" placeholder="Search questions or responses..." class="block w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all">
            </div>
        </div>

        <!-- Showing Count Indicator -->
        <div class="flex justify-between items-center px-2 mb-3 text-xs text-slate-400 font-medium">
            <p>Showing <span id="visibleCount" class="text-slate-200 font-bold">${processedResults.length}</span> of ${processedResults.length} results</p>
        </div>

        <!-- Data Table -->
        <div class="glass-panel rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50">
            <div class="overflow-x-auto">
                <table id="resultsTable" class="min-w-full divide-y divide-slate-700/50">
                    <thead class="bg-slate-800/80">
                        <tr>
                            <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">ID</th>
                            <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Question & Response</th>
                            <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                            <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Latency</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-700/50 bg-transparent">
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
        
        <footer class="mt-12 text-center text-sm text-slate-500">
            <p>Spark PMT Chatbot Tester &copy; ${new Date().getFullYear()}</p>
        </footer>
    </div>

    <!-- Filter JS -->
    <script>
        let activeFilter = 'all';

        function filterStatus(status) {
            activeFilter = status;
            
            ['all', 'passed', 'failed'].forEach(s => {
                const btn = document.getElementById('filter-btn-' + s);
                if (!btn) return;
                if (s === status) {
                    btn.className = 'px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border shadow-md ' +
                        (s === 'passed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10' :
                         s === 'failed' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-500/10' :
                         'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-indigo-500/10');
                } else {
                    btn.className = 'px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-700/50 transition-all duration-200';
                }
            });

            applyFilters();
        }

        function applyFilters() {
            const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase();
            const rows = document.querySelectorAll('#resultsTable tbody tr');
            let visibleCount = 0;

            rows.forEach(row => {
                const status = row.getAttribute('data-status');
                const searchData = (row.getAttribute('data-search') || '').toLowerCase();

                const matchesFilter = (activeFilter === 'all') || (status === activeFilter);
                const matchesSearch = !searchVal || searchData.includes(searchVal);

                if (matchesFilter && matchesSearch) {
                    row.style.display = '';
                    visibleCount++;
                } else {
                    row.style.display = 'none';
                }
            });

            const visibleCountElem = document.getElementById('visibleCount');
            if (visibleCountElem) visibleCountElem.innerText = visibleCount;
        }
    </script>
</body>
</html>`;

    fs.writeFileSync(outputHtml, html, 'utf-8');
    console.log(`Saved HTML report to ${outputHtml}`);

    // Auto-open in browser
    const fullHtmlPath = path.resolve(outputHtml);
    const openCmd = process.platform === 'win32'
        ? `start "" "${fullHtmlPath}"`
        : process.platform === 'darwin'
        ? `open "${fullHtmlPath}"`
        : `xdg-open "${fullHtmlPath}"`;

    exec(openCmd, (error) => {
        if (error) {
            console.log(`Note: HTML report ready at ${fullHtmlPath} (could not auto-open: ${error.message})`);
        } else {
            console.log(`Successfully opened ${outputHtml} in default web browser.`);
        }
    });
}

processQuestions().catch(console.error);

