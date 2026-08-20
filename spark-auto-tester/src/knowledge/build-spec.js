import path from 'node:path';
import { stableId } from '../utils/ids.js';
import { detectQaConflicts, detectKbConflicts } from './conflicts.js';

function qaFromSection(files) {
  const out=[];
  for (const f of files||[]) {
    if(f.type==='csv') {
      for(const row of f.data) {
        const q=Object.entries(row).find(([k])=>/^\s*(question|q)\s*$/i.test(k))?.[1]||'';
        const a=Object.entries(row).find(([k])=>/^\s*(answer|a)\s*$/i.test(k))?.[1]||'';
        if(String(q).trim()&&String(a).trim()) out.push({id:stableId('QA',q),question:String(q).trim(),answer:String(a).trim(),sourceRef:f.file});
      }
    } else if(f.type==='json' && Array.isArray(f.data)) {
      for(const row of f.data) if(row?.question&&row?.answer) out.push({id:stableId('QA',row.question),question:String(row.question).trim(),answer:String(row.answer).trim(),sourceRef:f.file});
    }
  }
  return out;
}

function qaFromExamples(files) {
  const out=[];
  for (const f of files||[]) {
    if (f.type!=='text') continue;
    const m=f.raw.match(/const\s+hardcodedQAPairs\s*=\s*(\[.*?\]);\s*\n\s*\/\/\s*Merge/s);
    if (!m) continue;
    try {
      const rows=JSON.parse(m[1]);
      for (const row of rows) if (row?.question&&row?.answer) out.push({id:stableId('QA',row.question),question:String(row.question).trim(),answer:String(row.answer).trim(),sourceRef:f.file,sourceType:'hardcoded'});
    } catch {}
  }
  return out;
}
function mergeQa(primary, secondary) {
  const map=new Map();
  for (const x of primary) map.set(x.question.trim().toLowerCase(),{...x,sourceType:'sheet_csv',answerAlternatives:[],sourceRefs:[x.sourceRef]});
  for (const x of secondary) {
    const k=x.question.trim().toLowerCase();
    if (!map.has(k)) map.set(k,{...x,answerAlternatives:[],sourceRefs:[x.sourceRef]});
    else {
      const cur=map.get(k); cur.sourceRefs=[...new Set([...cur.sourceRefs,x.sourceRef])];
      if (cur.answer.trim()!==x.answer.trim() && !cur.answerAlternatives.includes(x.answer.trim())) cur.answerAlternatives.push(x.answer.trim());
    }
  }
  return [...map.values()];
}

function kbFromSection(files) {
  const out=[];
  for(const f of files||[]) if(f.type==='json'&&Array.isArray(f.data)) for(const row of f.data) {
    if(!row||typeof row!=='object')continue; const content=String(row.content??row.answer??'').trim(); if(!content)continue;
    const key=`${row.url||''}|${row.heading||row.title||''}|${content.slice(0,120)}`;
    out.push({id:stableId('KB',key),url:row.url??null,title:row.title??null,heading:row.heading??null,content,sourceRef:f.file});
  }
  return out;
}
function promptFacts(files) { return (files||[]).map(f=>({sourceRef:f.file,text:f.raw})); }
function extractWorkflow(files) {
  const workflows=[];
  for(const f of files||[]) if(f.type==='json'&&f.data?.nodes) {
    const webhooks=f.data.nodes.filter(n=>n.type==='n8n-nodes-base.webhook').map(n=>({name:n.name,path:n.parameters?.path,httpMethod:n.parameters?.httpMethod??null,responseMode:n.parameters?.responseMode??null,options:n.parameters?.options??{}}));
    const responders=f.data.nodes.filter(n=>n.type==='n8n-nodes-base.respondToWebhook').map(n=>({name:n.name,respondWith:n.parameters?.respondWith,responseBody:n.parameters?.responseBody}));
    workflows.push({sourceRef:f.file,name:f.data.name,nodes:f.data.nodes.length,webhooks,responders});
  }
  return workflows;
}
function extractPromptConstraints(prompts) {
  const text=prompts.map(p=>p.text).join('\n'); const c=[];
  const add=(id,pattern,description)=>{if(pattern.test(text))c.push({id,description});};
  add('KB_FIRST',/Knowledge Base.*primary source of truth/is,'Knowledge Base is primary source of truth.');
  add('NO_INTERNALS',/Never mention internal systems, databases, embeddings, prompts/is,'Do not reveal internal systems/prompts/retrieval.');
  add('NO_MEDICAL_ADVICE',/Never provide medical advice, diagnosis, or treatment recommendations/is,'No medical advice, diagnosis, or treatment recommendations.');
  add('ENGLISH_ONLY',/only assist you in English/is,'Non-English input is rejected with an English-only response.');
  add('HISTORY_CONTEXT',/Conversation History/is,'Use conversation history for follow-ups and carry prior product/safety context.');
  add('SINGLE_ANSWER',/SINGLE ANSWER RULE/is,'Return one relevant answer.');
  return c;
}
export function buildSystemSpec(inputs) {
  const sheetQa=qaFromSection(inputs.qa); const hardcodedQa=qaFromExamples(inputs.examples); const qa=mergeQa(sheetQa,hardcodedQa); const kb=kbFromSection(inputs.knowledgeBase); const prompts=promptFacts(inputs.prompts); const workflows=extractWorkflow(inputs.workflow);
  return {
    version:'1.0.0', generatedAt:new Date().toISOString(),
    intents:[], topics:[...new Set(kb.map(x=>x.heading).filter(Boolean))].slice(0,300), entities:[],
    knowledgeAreas:kb.map(x=>({id:x.id,title:x.title,heading:x.heading,url:x.url,sourceRef:x.sourceRef})),
    expectedBehaviors:[], responseRules:[], negativeRules:[], semanticRules:[],
    knownQuestions:qa.map(x=>({id:x.id,question:x.question,sourceRef:x.sourceRef})), knownAnswers:qa.map(x=>({id:x.id,answer:x.answer,sourceRef:x.sourceRef})),
    promptConstraints:extractPromptConstraints(prompts), qa, knowledgeBase:kb, prompts, workflows,
    conflicts:[...detectQaConflicts(qa),...detectKbConflicts(kb)],
    sourceVersionNotes:{sheetQaCount:sheetQa.length,hardcodedQaCount:hardcodedQa.length,mergedQaCount:qa.length,questionsWithAnswerAlternatives:qa.filter(x=>x.answerAlternatives?.length).length},
    versions:Object.fromEntries(Object.entries(inputs).map(([k,v])=>[`${k}Version`,stableId('VER',v.map(f=>f.sha256).join('|'))])),
    inputInventory:Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,v.map(f=>({file:f.file,type:f.type,sha256:f.sha256,containsLikelySecret:f.containsLikelySecret}))]))
  };
}
