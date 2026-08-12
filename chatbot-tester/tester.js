const fs = require('fs');
const readline = require('readline');
const crypto = require('crypto');

// Setup
const inputCsv = process.argv[2] || 'sample_questions.csv';
const outputJson = 'test_report.json';
const outputHtml = 'test_report.html';
const sessionId = 'test-session-' + crypto.randomBytes(4).toString('hex');

async function processQuestions() {
    if (!fs.existsSync(inputCsv)) {
        console.error(`Error: File ${inputCsv} not found. Please provide a valid CSV file.`);
        console.log(`Usage: node tester.js <path_to_csv>`);
        process.exit(1);
    }

    const questions = [];
    const fileStream = fs.createReadStream(inputCsv);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (line.trim()) {
            let raw = line.trim();
            if (raw.toLowerCase().startsWith('question') || raw.startsWith('VagueQuestion')) continue;
            
            let vagueQ = raw;
            let contextQ = null;
            
            // Parse "Vague","Context" format
            if (raw.includes('","')) {
                const parts = raw.split('","');
                vagueQ = parts[0].replace(/^"/, '').trim();
                contextQ = parts[1].replace(/"$/, '').trim();
            } else if (raw.includes(',')) {
                // Parse Vague,Context or Single column with trailing comma format
                const parts = raw.split(',');
                vagueQ = parts[0].trim();
                contextQ = parts[1] ? parts[1].trim() : null;
            } else {
                // Single column format
                vagueQ = raw.trim();
            }
            if (vagueQ.startsWith('"') && vagueQ.endsWith('"')) {
                vagueQ = vagueQ.substring(1, vagueQ.length - 1).trim();
            }
            if (vagueQ) {
                questions.push({ q1: vagueQ, q2: contextQ || null });
            }
        }
    }

    console.log(`Found ${questions.length} questions in ${inputCsv}. Starting test...`);
    const results = [];

    for (let i = 0; i < questions.length; i++) {
        const { q1: question, q2: contextFromFile } = questions[i];
        console.log(`\n--- Scenario ${i + 1}/${questions.length} ---`);
        console.log(`Turn 1 Sending: "${question}"`);
        
        // Generate a UNIQUE session ID for each scenario to test fresh memory
        const scenarioSessionId = 'multi-test-' + crypto.randomBytes(4).toString('hex');
        
        // Turn 1
        const start1 = Date.now();
        let resp1Data = null;
        let isSuccess1 = false;
        let err1 = null;

        try {
            const url1 = `https://n8n.srv917960.hstgr.cloud/webhook/spark-chatbot?chatInput=${encodeURIComponent(question)}&sessionId=${encodeURIComponent(scenarioSessionId)}&is_dev=true`;
            const res1 = await fetch(url1, { method: 'GET', headers: { 'Accept': 'application/json, text/plain, */*' } });
            const text1 = await res1.text();
            try { resp1Data = JSON.parse(text1); } catch(e) { resp1Data = text1; }
            if (res1.ok) isSuccess1 = true; else err1 = `HTTP Error ${res1.status}`;
        } catch (error) { err1 = error.message; }
        const dur1 = Date.now() - start1;

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Turn 2
        let contextFollowUp = contextFromFile;
        if (!contextFollowUp) {
            const contexts = [
                "I am asking about the Ultima 5",
                "The Ultima 20 device",
                "I mean the Ultima 11 system",
                "For the Thermotech",
                "Talking about the TENS pads"
            ];
            contextFollowUp = contexts[Math.floor(Math.random() * contexts.length)];
        }
        console.log(`Turn 2 Sending: "${contextFollowUp}"`);
        
        const start2 = Date.now();
        let resp2Data = null;
        let isSuccess2 = false;
        let err2 = null;

        try {
            const url2 = `https://n8n.srv917960.hstgr.cloud/webhook/spark-chatbot?chatInput=${encodeURIComponent(contextFollowUp)}&sessionId=${encodeURIComponent(scenarioSessionId)}&is_dev=true`;
            const res2 = await fetch(url2, { method: 'GET', headers: { 'Accept': 'application/json, text/plain, */*' } });
            const text2 = await res2.text();
            try { resp2Data = JSON.parse(text2); } catch(e) { resp2Data = text2; }
            if (res2.ok) isSuccess2 = true; else err2 = `HTTP Error ${res2.status}`;
        } catch (error) { err2 = error.message; }
        const dur2 = Date.now() - start2;

        results.push({
            id: i + 1,
            question1: question,
            response1: resp1Data,
            dur1: dur1,
            err1: err1,
            question2: contextFollowUp,
            response2: resp2Data,
            dur2: dur2,
            err2: err2,
            success: isSuccess1 && isSuccess2,
            durationMs: dur1 + dur2,
            sessionId: scenarioSessionId,
            timestamp: new Date().toISOString()
        });
        
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Save JSON
    fs.writeFileSync(outputJson, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\nSaved raw data to ${outputJson}`);

    // Generate HTML
    generateHtmlReport(results);
}

function generateHtmlReport(results) {
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    const avgDuration = results.length > 0 ? (results.reduce((acc, r) => acc + r.durationMs, 0) / results.length).toFixed(0) : 0;
    
    // Convert object responses to string representation for display
    const formatResponse = (resp) => {
        if (resp === null || resp === undefined) return '<span style="color: #64748b;">No response</span>';
        if (typeof resp === 'string') return resp;
        if (typeof resp === 'object') {
            if (resp.output) return typeof resp.output === 'string' ? resp.output : JSON.stringify(resp.output, null, 2);
            if (resp.answer) return typeof resp.answer === 'string' ? resp.answer : JSON.stringify(resp.answer, null, 2);
            if (resp.text) return typeof resp.text === 'string' ? resp.text : JSON.stringify(resp.text, null, 2);
            return JSON.stringify(resp, null, 2);
        }
        return String(resp);
    };

    const rows = results.map(r => `
        <tr class="transition-all hover:bg-slate-800/50 group border-b border-slate-700/50">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-400 align-top">#${r.id}</td>
            <td class="px-6 py-4 align-top">
                <div class="space-y-4">
                    <div class="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
                        <p class="text-xs font-semibold text-indigo-400 mb-1 uppercase tracking-wider">Turn 1 (Vague)</p>
                        <p class="text-sm font-medium text-slate-200 mb-2">User: ${r.question1}</p>
                        <div class="pl-3 border-l-2 border-indigo-500/30">
                            <p class="text-xs text-slate-400 mb-1">Bot Response (${r.dur1}ms)</p>
                            <div class="text-sm text-slate-300 max-h-32 overflow-y-auto custom-scrollbar whitespace-pre-wrap">${formatResponse(r.response1)}</div>
                        </div>
                    </div>
                    <div class="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
                        <p class="text-xs font-semibold text-emerald-400 mb-1 uppercase tracking-wider">Turn 2 (Context)</p>
                        <p class="text-sm font-medium text-slate-200 mb-2">User: ${r.question2}</p>
                        <div class="pl-3 border-l-2 border-emerald-500/30">
                            <p class="text-xs text-slate-400 mb-1">Bot Final Answer (${r.dur2}ms)</p>
                            <div class="text-sm text-slate-300 max-h-32 overflow-y-auto custom-scrollbar whitespace-pre-wrap">${formatResponse(r.response2)}</div>
                        </div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 align-top">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${r.success ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20' : 'bg-rose-400/10 text-rose-400 border border-rose-400/20'}">
                    ${r.success ? 'Success' : 'Failed'}
                </span>
                ${r.err1 ? `<p class="mt-1 text-xs text-rose-400">T1: ${r.err1}</p>` : ''}
                ${r.err2 ? `<p class="mt-1 text-xs text-rose-400">T2: ${r.err2}</p>` : ''}
            </td>
            <td class="px-6 py-4 text-sm text-slate-400 whitespace-nowrap align-top">${r.durationMs} ms total</td>
        </tr>
    `).join('');

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
    <!-- Decorative background elements -->
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
                <p class="text-slate-400 ml-13">Session ID: <span class="font-mono text-xs text-slate-300 bg-slate-800 px-2 py-1 rounded">${sessionId}</span></p>
            </div>
            
            <div class="flex gap-4 items-center">
                <p class="text-sm text-slate-400">Generated on ${new Date().toLocaleString()}</p>
            </div>
        </header>

        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <div class="glass-panel rounded-2xl p-6 glow-effect">
                <p class="text-sm font-medium text-slate-400 mb-1">Total Questions</p>
                <p class="text-3xl font-bold text-white">${results.length}</p>
            </div>
            <div class="glass-panel rounded-2xl p-6 glow-effect border-l-2 border-l-emerald-500/50">
                <p class="text-sm font-medium text-emerald-400 mb-1">Successful Calls</p>
                <div class="flex items-baseline gap-2">
                    <p class="text-3xl font-bold text-white">${successCount}</p>
                    <p class="text-sm font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">${results.length ? ((successCount/results.length)*100).toFixed(1) : 0}%</p>
                </div>
            </div>
            <div class="glass-panel rounded-2xl p-6 glow-effect border-l-2 border-l-rose-500/50">
                <p class="text-sm font-medium text-rose-400 mb-1">Failed Calls</p>
                <div class="flex items-baseline gap-2">
                    <p class="text-3xl font-bold text-white">${failCount}</p>
                    <p class="text-sm font-medium text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-full">${results.length ? ((failCount/results.length)*100).toFixed(1) : 0}%</p>
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

        <!-- Data Table -->
        <div class="glass-panel rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50">
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-slate-700/50">
                    <thead class="bg-slate-800/80">
                        <tr>
                            <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">ID</th>
                            <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Conversation Log</th>
                            <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                            <th scope="col" class="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Time</th>
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
</body>
</html>`;

    fs.writeFileSync(outputHtml, html, 'utf-8');
    console.log(`Saved beautifully crafted HTML report to ${outputHtml}`);
}

processQuestions().catch(console.error);
