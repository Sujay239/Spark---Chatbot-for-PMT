const fs = require('fs');
const readline = require('readline');
const crypto = require('crypto');
const path = require('path');

// Default configurations
const DEFAULT_INPUT = path.join(__dirname, 'sample_questions.csv');
const DEFAULT_OUTPUT_JSON = path.join(__dirname, 'qa_results.json');
const DEFAULT_OUTPUT_HTML = path.join(__dirname, 'qa_report.html');
const WEBHOOK_BASE_URL = 'https://n8n.srv917960.hstgr.cloud/webhook/spark-chatbot';

// CLI arguments parsing
const args = process.argv.slice(2);
let inputFile = DEFAULT_INPUT;
let outputJsonFile = DEFAULT_OUTPUT_JSON;
let outputHtmlFile = DEFAULT_OUTPUT_HTML;
let delayMs = 800; // polite rate limiting delay between queries
let limit = null; // optional limit on number of questions

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' || args[i] === '-i') {
        inputFile = args[++i];
    } else if (args[i] === '--json' || args[i] === '-j') {
        outputJsonFile = args[++i];
    } else if (args[i] === '--html' || args[i] === '-o') {
        outputHtmlFile = args[++i];
    } else if (args[i] === '--delay' || args[i] === '-d') {
        delayMs = parseInt(args[++i], 10) || 800;
    } else if (args[i] === '--limit' || args[i] === '-l') {
        limit = parseInt(args[++i], 10);
    } else if (!args[i].startsWith('-') && i === 0) {
        inputFile = args[i];
    }
}

/**
 * Load questions from CSV, JSON, or TXT format
 */
async function loadQuestions(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Input file not found at: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    const questions = [];

    if (ext === '.json') {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
            parsed.forEach((item, index) => {
                if (typeof item === 'string') {
                    if (item.trim()) questions.push({ id: index + 1, question: item.trim() });
                } else if (typeof item === 'object' && item !== null) {
                    const q = item.question || item.q || item.chatInput || item.prompt;
                    if (q) questions.push({ id: index + 1, question: String(q).trim(), category: item.category || '' });
                }
            });
        }
    } else {
        // Line-by-line reading for CSV and TXT
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let lineIndex = 0;
        for await (const rawLine of rl) {
            lineIndex++;
            const line = rawLine.trim();
            if (!line) continue;

            // Skip header if present
            if (lineIndex === 1 && /^(question|vaguequestion|prompt|q|query)/i.test(line)) {
                continue;
            }

            let q = line;
            let category = '';

            if (ext === '.csv') {
                // Parse CSV line
                if (line.startsWith('"') && line.includes('","')) {
                    const parts = line.split('","');
                    q = parts[0].replace(/^"/, '').trim();
                    if (parts[1]) category = parts[1].replace(/"$/, '').trim();
                } else if (line.includes(',')) {
                    const firstComma = line.indexOf(',');
                    q = line.substring(0, firstComma).trim();
                    category = line.substring(firstComma + 1).replace(/^"+|"+$/g, '').trim();
                }
            }

            // Strip enclosing quotes if any
            if (q.startsWith('"') && q.endsWith('"')) {
                q = q.substring(1, q.length - 1).trim();
            }

            if (q) {
                questions.push({
                    id: questions.length + 1,
                    question: q,
                    category: category
                });
            }
        }
    }

    return limit && limit > 0 ? questions.slice(0, limit) : questions;
}

/**
 * Send question to the webhook and capture response + timing
 */
async function askChatbot(question, index, total) {
    const sessionId = `spark-test-${crypto.randomBytes(4).toString('hex')}`;
    const startTime = Date.now();
    let responseData = null;
    let answerText = '';
    let isSuccess = false;
    let errorMsg = null;
    let statusCode = null;
    let isFallback = false;
    let responseType = 'unknown';

    const url = `${WEBHOOK_BASE_URL}?chatInput=${encodeURIComponent(question)}&sessionId=${encodeURIComponent(sessionId)}&is_dev=true`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Spark-PMT-Direct-Tester/2.0'
            }
        });

        statusCode = response.status;
        const text = await response.text();

        try {
            responseData = JSON.parse(text);
        } catch {
            responseData = text;
        }

        if (response.ok) {
            isSuccess = true;

            // Extract answer text from various response structures
            if (typeof responseData === 'string') {
                answerText = responseData;
            } else if (typeof responseData === 'object' && responseData !== null) {
                answerText = responseData.output || responseData.answer || responseData.text || responseData.response || JSON.stringify(responseData);
            }

            // Check if fallback was triggered
            if (
                /couldn't find a relevant answer|sorry.*find.*answer|i am spark.*how can i help you today/i.test(answerText) &&
                !/how long does it take to feel relief|1-800-239-7880/i.test(question)
            ) {
                isFallback = true;
                responseType = 'fallback';
            } else if (responseData && responseData.matched_question) {
                responseType = 'predefined_matched';
            } else {
                responseType = 'answered';
            }
        } else {
            errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
            responseType = 'http_error';
        }
    } catch (err) {
        errorMsg = err.message || String(err);
        responseType = 'network_error';
    }

    const durationMs = Date.now() - startTime;

    return {
        id: index + 1,
        question: question,
        answer: answerText || (errorMsg ? `[Error] ${errorMsg}` : 'No response'),
        rawResponse: responseData,
        statusCode: statusCode,
        success: isSuccess,
        isFallback: isFallback,
        responseType: responseType,
        error: errorMsg,
        durationMs: durationMs,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
    };
}

/**
 * Generate interactive HTML Report with modern UI
 */
function generateHtmlReport(results, metadata) {
    const total = results.length;
    const successful = results.filter(r => r.success && !r.isFallback).length;
    const fallbacks = results.filter(r => r.isFallback).length;
    const errors = results.filter(r => !r.success).length;
    const totalDuration = results.reduce((acc, r) => acc + r.durationMs, 0);
    const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0;
    const minDuration = total > 0 ? Math.min(...results.map(r => r.durationMs)) : 0;
    const maxDuration = total > 0 ? Math.max(...results.map(r => r.durationMs)) : 0;

    const resultsJsonString = JSON.stringify(results).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

    const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spark PMT - Chatbot QA Test Report</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
                        mono: ['"JetBrains Mono"', 'monospace']
                    }
                }
            }
        }
    </script>
    <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .glass-card {
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.07);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(30, 41, 59, 0.5); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.5); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.8); }
    </style>
</head>
<body class="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-teal-500/30 selection:text-teal-200">
    <!-- Ambient glowing backgrounds -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div class="absolute -top-40 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"></div>
        <div class="absolute top-1/3 -right-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div class="absolute bottom-10 left-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
    </div>

    <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <!-- Top Navbar & Title -->
        <header class="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-800">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-400 via-cyan-500 to-indigo-600 p-[1px] shadow-lg shadow-teal-500/20">
                    <div class="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center">
                        <svg class="w-6 h-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                </div>
                <div>
                    <div class="flex items-center gap-3">
                        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Spark PMT Chatbot QA Tester</h1>
                        <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20">Direct Run</span>
                    </div>
                    <p class="text-sm text-slate-400 mt-1">Single-Turn Webhook Accuracy & Latency Evaluation</p>
                </div>
            </div>

            <div class="flex flex-wrap items-center gap-3">
                <button onclick="exportToCsv()" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition shadow-sm">
                    <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    Export CSV
                </button>
                <button onclick="exportToJson()" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition shadow-sm">
                    <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
                    Export JSON
                </button>
                <button onclick="copySummary()" id="copySummaryBtn" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 transition shadow-lg shadow-teal-500/20 font-bold">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                    Copy Summary
                </button>
            </div>
        </header>

        <!-- KPI Metrics Grid -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 my-8">
            <div class="glass-card rounded-2xl p-5 border border-slate-800 hover:border-slate-700 transition">
                <div class="flex items-center justify-between">
                    <p class="text-xs font-medium uppercase tracking-wider text-slate-400">Total Tested</p>
                    <span class="w-2 h-2 rounded-full bg-slate-400"></span>
                </div>
                <p class="text-3xl font-extrabold text-white mt-2">${total}</p>
                <p class="text-xs text-slate-500 mt-1">Questions executed</p>
            </div>

            <div class="glass-card rounded-2xl p-5 border border-emerald-500/20 bg-emerald-950/10 hover:border-emerald-500/30 transition">
                <div class="flex items-center justify-between">
                    <p class="text-xs font-medium uppercase tracking-wider text-emerald-400">Answered</p>
                    <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                </div>
                <p class="text-3xl font-extrabold text-emerald-300 mt-2">${successful}</p>
                <p class="text-xs text-emerald-400/70 mt-1">${total ? ((successful / total) * 100).toFixed(1) : 0}% success rate</p>
            </div>

            <div class="glass-card rounded-2xl p-5 border border-amber-500/20 bg-amber-950/10 hover:border-amber-500/30 transition">
                <div class="flex items-center justify-between">
                    <p class="text-xs font-medium uppercase tracking-wider text-amber-400">Fallbacks</p>
                    <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                </div>
                <p class="text-3xl font-extrabold text-amber-300 mt-2">${fallbacks}</p>
                <p class="text-xs text-amber-400/70 mt-1">${total ? ((fallbacks / total) * 100).toFixed(1) : 0}% fallback triggered</p>
            </div>

            <div class="glass-card rounded-2xl p-5 border border-rose-500/20 bg-rose-950/10 hover:border-rose-500/30 transition">
                <div class="flex items-center justify-between">
                    <p class="text-xs font-medium uppercase tracking-wider text-rose-400">Errors</p>
                    <span class="w-2 h-2 rounded-full bg-rose-400"></span>
                </div>
                <p class="text-3xl font-extrabold text-rose-300 mt-2">${errors}</p>
                <p class="text-xs text-rose-400/70 mt-1">${errors === 0 ? 'Zero network failures' : 'Check server status'}</p>
            </div>

            <div class="glass-card rounded-2xl p-5 border border-cyan-500/20 bg-cyan-950/10 col-span-2 md:col-span-1 hover:border-cyan-500/30 transition">
                <div class="flex items-center justify-between">
                    <p class="text-xs font-medium uppercase tracking-wider text-cyan-400">Avg Latency</p>
                    <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
                </div>
                <div class="flex items-baseline gap-1 mt-2">
                    <p class="text-3xl font-extrabold text-cyan-300">${avgDuration}</p>
                    <span class="text-xs font-mono text-cyan-400">ms</span>
                </div>
                <p class="text-xs text-slate-400 mt-1">Min: ${minDuration}ms / Max: ${maxDuration}ms</p>
            </div>
        </div>

        <!-- Filter & Search Bar -->
        <div class="glass-card rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="relative w-full sm:w-96">
                <input type="text" id="searchInput" oninput="applyFilters()" placeholder="Search question or answer keywords..." 
                    class="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2.5 pl-10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition">
                <svg class="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
            </div>

            <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
                <button onclick="setStatusFilter('all')" id="filter-all" class="filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-500 text-slate-950 transition">All (${total})</button>
                <button onclick="setStatusFilter('answered')" id="filter-answered" class="filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition">Answered (${successful})</button>
                <button onclick="setStatusFilter('fallback')" id="filter-fallback" class="filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition">Fallback (${fallbacks})</button>
                <button onclick="setStatusFilter('error')" id="filter-error" class="filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition">Error (${errors})</button>
                
                <select id="sortSelect" onchange="applyFilters()" class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-teal-500 transition">
                    <option value="id-asc">Sort: ID (Asc)</option>
                    <option value="id-desc">Sort: ID (Desc)</option>
                    <option value="latency-fast">Latency: Fastest First</option>
                    <option value="latency-slow">Latency: Slowest First</option>
                </select>
            </div>
        </div>

        <!-- Questions & Answers Table -->
        <div class="glass-card rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-slate-800" id="qaTable">
                    <thead class="bg-slate-950/80">
                        <tr>
                            <th class="px-5 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-16">#</th>
                            <th class="px-5 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-2/5">Question Asked</th>
                            <th class="px-5 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Chatbot Answer</th>
                            <th class="px-5 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-28">Status</th>
                            <th class="px-5 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider w-28">Latency</th>
                            <th class="px-4 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider w-16">Action</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800/60 bg-transparent text-sm" id="tableBody">
                        <!-- Populated by JavaScript -->
                    </tbody>
                </table>
            </div>

            <div id="noResults" class="hidden p-12 text-center">
                <svg class="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="text-slate-400 font-medium">No results match your filter or search query.</p>
                <button onclick="resetFilters()" class="mt-3 px-4 py-1.5 rounded-lg text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition">Reset Filters</button>
            </div>
        </div>

        <!-- Footer -->
        <footer class="mt-10 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>Spark PMT Direct Chatbot Tester &bull; Generated: ${new Date(metadata.generatedAt).toLocaleString()}</p>
            <p>Source file: <span class="font-mono text-slate-400">${metadata.inputFile}</span> (${metadata.total} items)</p>
        </footer>
    </div>

    <!-- Raw JSON Inspector Modal -->
    <div id="jsonModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
        <div class="glass-card bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div class="flex items-center justify-between p-5 border-b border-slate-800">
                <h3 class="text-base font-bold text-white flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-teal-400"></span>
                    Raw Response Inspector (<span id="modalId">#1</span>)
                </h3>
                <button onclick="closeModal()" class="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
            <div class="p-5 overflow-y-auto custom-scrollbar flex-1">
                <div class="mb-3">
                    <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Question</p>
                    <p id="modalQuestion" class="text-sm font-medium text-teal-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800"></p>
                </div>
                <div>
                    <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Full Response JSON</p>
                    <pre id="modalJson" class="font-mono text-xs text-emerald-400 bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto custom-scrollbar whitespace-pre-wrap"></pre>
                </div>
            </div>
            <div class="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-950/40 rounded-b-2xl">
                <button onclick="copyModalJson()" class="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition">Copy JSON</button>
                <button onclick="closeModal()" class="px-4 py-2 rounded-xl text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition">Close</button>
            </div>
        </div>
    </div>

    <!-- Client-side Interactive JavaScript -->
    <script>
        const rawResults = ${resultsJsonString};
        let currentStatusFilter = 'all';
        let currentModalData = null;

        function getStatusBadge(item) {
            if (!item.success) {
                return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">Error</span>';
            }
            if (item.isFallback) {
                return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Fallback</span>';
            }
            return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Answered</span>';
        }

        function getLatencyBadge(durationMs) {
            if (durationMs < 1000) {
                return '<span class="font-mono text-xs font-semibold text-emerald-400">' + durationMs + ' ms</span>';
            } else if (durationMs < 3000) {
                return '<span class="font-mono text-xs font-semibold text-amber-400">' + durationMs + ' ms</span>';
            }
            return '<span class="font-mono text-xs font-semibold text-rose-400">' + durationMs + ' ms</span>';
        }

        function renderTable(data) {
            const tbody = document.getElementById('tableBody');
            const noResults = document.getElementById('noResults');

            if (data.length === 0) {
                tbody.innerHTML = '';
                noResults.classList.remove('hidden');
                return;
            }
            noResults.classList.add('hidden');

            tbody.innerHTML = data.map(item => {
                const cleanAnswer = typeof item.answer === 'string' ? item.answer : JSON.stringify(item.answer);
                const safeAnswer = cleanAnswer
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');

                return \`
                    <tr class="hover:bg-slate-800/40 transition border-b border-slate-800/50 group">
                        <td class="px-5 py-4 text-xs font-mono text-slate-500 align-top">#\${item.id}</td>
                        <td class="px-5 py-4 align-top">
                            <p class="font-medium text-slate-200 text-sm leading-snug">\${item.question}</p>
                            <p class="text-[11px] font-mono text-slate-500 mt-1">Session: \${item.sessionId || 'N/A'}</p>
                        </td>
                        <td class="px-5 py-4 align-top">
                            <div class="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800/80 text-sm text-slate-300 max-h-48 overflow-y-auto custom-scrollbar whitespace-pre-wrap leading-relaxed select-text">
                                \${safeAnswer}
                            </div>
                        </td>
                        <td class="px-5 py-4 whitespace-nowrap align-top">
                            \${getStatusBadge(item)}
                        </td>
                        <td class="px-5 py-4 whitespace-nowrap text-right align-top">
                            \${getLatencyBadge(item.durationMs)}
                        </td>
                        <td class="px-4 py-4 whitespace-nowrap text-center align-top">
                            <button onclick="openModal(\${item.id})" title="Inspect Raw JSON" class="p-2 rounded-lg bg-slate-800 hover:bg-teal-500/20 text-slate-400 hover:text-teal-300 border border-slate-700/60 transition">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                            </button>
                        </td>
                    </tr>
                \`;
            }).join('');
        }

        function setStatusFilter(status) {
            currentStatusFilter = status;
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.className = 'filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition';
            });
            const activeBtn = document.getElementById('filter-' + status);
            if (activeBtn) {
                activeBtn.className = 'filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-500 text-slate-950 transition font-bold';
            }
            applyFilters();
        }

        function applyFilters() {
            const query = (document.getElementById('searchInput').value || '').toLowerCase().trim();
            const sortMode = document.getElementById('sortSelect').value;

            let filtered = rawResults.filter(item => {
                // Status Filter
                if (currentStatusFilter === 'answered' && (!item.success || item.isFallback)) return false;
                if (currentStatusFilter === 'fallback' && !item.isFallback) return false;
                if (currentStatusFilter === 'error' && item.success) return false;

                // Keyword Query Search
                if (query) {
                    const qMatch = (item.question || '').toLowerCase().includes(query);
                    const aMatch = (item.answer || '').toLowerCase().includes(query);
                    const idMatch = String(item.id) === query || ('#' + item.id) === query;
                    if (!qMatch && !aMatch && !idMatch) return false;
                }
                return true;
            });

            // Sorting
            if (sortMode === 'id-asc') {
                filtered.sort((a, b) => a.id - b.id);
            } else if (sortMode === 'id-desc') {
                filtered.sort((a, b) => b.id - a.id);
            } else if (sortMode === 'latency-fast') {
                filtered.sort((a, b) => a.durationMs - b.durationMs);
            } else if (sortMode === 'latency-slow') {
                filtered.sort((a, b) => b.durationMs - a.durationMs);
            }

            renderTable(filtered);
        }

        function resetFilters() {
            document.getElementById('searchInput').value = '';
            document.getElementById('sortSelect').value = 'id-asc';
            setStatusFilter('all');
        }

        function openModal(id) {
            const item = rawResults.find(r => r.id === id);
            if (!item) return;
            currentModalData = item;

            document.getElementById('modalId').textContent = '#' + item.id;
            document.getElementById('modalQuestion').textContent = item.question;
            document.getElementById('modalJson').textContent = JSON.stringify(item.rawResponse || item, null, 2);
            document.getElementById('jsonModal').classList.remove('hidden');
        }

        function closeModal() {
            document.getElementById('jsonModal').classList.add('hidden');
            currentModalData = null;
        }

        function copyModalJson() {
            if (!currentModalData) return;
            navigator.clipboard.writeText(JSON.stringify(currentModalData.rawResponse || currentModalData, null, 2));
            alert('JSON copied to clipboard!');
        }

        function exportToJson() {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rawResults, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", "spark_qa_test_results.json");
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        }

        function exportToCsv() {
            const headers = ["ID", "Question", "Answer", "Status", "Duration_ms", "SessionId", "Timestamp"];
            const rows = rawResults.map(r => [
                r.id,
                '"' + (r.question || '').replace(/"/g, '""') + '"',
                '"' + (r.answer || '').replace(/"/g, '""') + '"',
                r.isFallback ? "Fallback" : (r.success ? "Answered" : "Error"),
                r.durationMs,
                r.sessionId,
                r.timestamp
            ]);

            const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\\n");
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", encodeURI(csvContent));
            downloadAnchor.setAttribute("download", "spark_qa_test_results.csv");
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        }

        function copySummary() {
            const summary = \`Spark PMT Chatbot QA Report Summary:
- Total Tested: ${total}
- Successfully Answered: ${successful} (${total ? ((successful/total)*100).toFixed(1) : 0}%)
- Fallbacks: ${fallbacks}
- Errors: ${errors}
- Avg Response Time: ${avgDuration}ms\`;
            navigator.clipboard.writeText(summary);
            const btn = document.getElementById('copySummaryBtn');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Copied!';
            setTimeout(() => { btn.innerHTML = originalText; }, 2000);
        }

        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });

        // Initialize table on load
        document.addEventListener('DOMContentLoaded', () => {
            renderTable(rawResults);
        });
    </script>
</body>
</html>`;

    return html;
}

/**
 * Main execution loop
 */
async function main() {
    console.log(`\n========================================================`);
    console.log(`🚀 SPARK PMT DIRECT CHATBOT TESTER`);
    console.log(`========================================================`);
    console.log(`Input File:       ${inputFile}`);
    console.log(`JSON Output:      ${outputJsonFile}`);
    console.log(`HTML Report:      ${outputHtmlFile}`);
    console.log(`Delay Between Qs: ${delayMs}ms`);
    if (limit) console.log(`Limit:            ${limit} questions`);
    console.log(`Webhook Endpoint: ${WEBHOOK_BASE_URL}`);
    console.log(`--------------------------------------------------------`);

    let questions = [];
    try {
        questions = await loadQuestions(inputFile);
    } catch (err) {
        console.error(`❌ Failed to read questions:`, err.message);
        process.exit(1);
    }

    if (questions.length === 0) {
        console.warn(`⚠️ No questions found in ${inputFile}`);
        process.exit(0);
    }

    console.log(`Loaded ${questions.length} questions. Starting testing sequence...\n`);

    const results = [];
    const startTimeOverall = Date.now();

    for (let i = 0; i < questions.length; i++) {
        const item = questions[i];
        process.stdout.write(`[${i + 1}/${questions.length}] Asking: "${item.question.length > 55 ? item.question.substring(0, 52) + '...' : item.question}" `);

        const result = await askChatbot(item.question, i, questions.length);
        results.push(result);

        const statusIcon = !result.success ? '❌ [ERROR]' : (result.isFallback ? '⚠️ [FALLBACK]' : '✅ [OK]');
        console.log(`${statusIcon} (${result.durationMs}ms)`);

        // Polite delay between questions to prevent rate limits
        if (i < questions.length - 1 && delayMs > 0) {
            await new Promise(r => setTimeout(r, delayMs));
        }
    }

    const totalDurationSeconds = ((Date.now() - startTimeOverall) / 1000).toFixed(1);
    console.log(`\n--------------------------------------------------------`);
    console.log(`🏁 Completed ${results.length} questions in ${totalDurationSeconds}s`);

    // 1. Save JSON output
    const outputData = {
        metadata: {
            inputFile: path.basename(inputFile),
            total: results.length,
            successful: results.filter(r => r.success && !r.isFallback).length,
            fallbacks: results.filter(r => r.isFallback).length,
            errors: results.filter(r => !r.success).length,
            avgDurationMs: results.length > 0 ? Math.round(results.reduce((a, r) => a + r.durationMs, 0) / results.length) : 0,
            generatedAt: new Date().toISOString()
        },
        results: results
    };

    fs.writeFileSync(outputJsonFile, JSON.stringify(outputData, null, 2), 'utf-8');
    console.log(`💾 Saved structured JSON to: ${outputJsonFile}`);

    // 2. Save HTML Report
    const html = generateHtmlReport(results, outputData.metadata);
    fs.writeFileSync(outputHtmlFile, html, 'utf-8');
    console.log(`🌐 Saved interactive HTML report to: ${outputHtmlFile}`);
    console.log(`========================================================\n`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
