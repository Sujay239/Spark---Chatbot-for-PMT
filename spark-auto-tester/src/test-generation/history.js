import { exists, readJson, writeJson } from '../utils/fs.js';

export async function loadQuestionHistory(config) {
  const file=config.storage.questionHistoryFile;
  if(!file || !await exists(file)) return [];
  try {
    const data=await readJson(file);
    return Array.isArray(data) ? data : (data.questions||[]);
  } catch { return []; }
}

export async function appendQuestionHistory(config,tests,{runId}={}) {
  const file=config.storage.questionHistoryFile;
  if(!file) return;
  const current=await loadQuestionHistory(config);
  const seen=new Set(current.map(x=>String(x.question||x).trim().toLowerCase()));
  for(const t of tests){
    if(t.category==='REGRESSION') continue;
    const key=String(t.question||'').trim().toLowerCase();
    if(!key || seen.has(key)) continue;
    current.push({question:t.question,category:t.category,generatedFrom:t.generatedFrom||[],runId:runId||null,createdAt:new Date().toISOString()});
    seen.add(key);
  }
  const max=10000;
  await writeJson(file,{updatedAt:new Date().toISOString(),questions:current.slice(-max)});
}
