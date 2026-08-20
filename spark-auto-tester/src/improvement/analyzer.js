import path from 'node:path';
import { promises as fs } from 'node:fs';
import { ensureDir } from '../utils/fs.js';

const PRIORITY={SECURITY_VIOLATION:'CRITICAL',HALLUCINATION:'CRITICAL',UNSUPPORTED_CLAIM:'HIGH',RETRIEVAL_FAILURE:'HIGH',WRONG_ANSWER:'HIGH',PROMPT_VIOLATION:'HIGH',MISSING_INFORMATION:'MEDIUM',INCOMPLETE_RESPONSE:'MEDIUM',OFF_TOPIC:'MEDIUM',MALFORMED_RESPONSE:'HIGH',TIMEOUT:'MEDIUM',WEBHOOK_ERROR:'HIGH'};
const BAD=new Set(['FAILED','PARTIAL','HALLUCINATION','UNSAFE','OFF_TOPIC','INVALID','TIMEOUT','WEBHOOK_ERROR']);
export function analyzeFailures(tests){const groups=new Map();for(const t of tests)for(const r of t.failureReasons||[]){if(!groups.has(r))groups.set(r,[]);groups.get(r).push(t);}return [...groups].map(([reason,arr])=>({reason,count:arr.length,priority:PRIORITY[reason]||'MEDIUM',affectedTests:arr.map(x=>x.testId),observedFact:`${arr.length} test(s) produced ${reason}.`,probableCause:inferCause(reason),rootCauseConfidence:confidence(reason),regressionAffected:arr.some(x=>x.category==='REGRESSION'),priorityScore:score(PRIORITY[reason]||'MEDIUM',arr),recommendation:recommend(reason,arr),responsibleLayer:layer(reason),expectedImpact:'Reduce recurrence of this failure class in subsequent regression runs.'})).sort((a,b)=>rank(a.priority)-rank(b.priority)||b.count-a.count);}
function rank(x){return {CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3}[x]??4;}
function confidence(r){if(/MALFORMED_RESPONSE/.test(r))return 'CONFIRMED';if(/WEBHOOK_ERROR|TIMEOUT|SECURITY_VIOLATION|RETRIEVAL_FAILURE/.test(r))return 'LIKELY';return 'POSSIBLE';}
function score(priority,arr){const base={CRITICAL:90,HIGH:70,MEDIUM:45,LOW:20}[priority]||30,freq=Math.min(20,arr.length*2),regression=arr.some(x=>x.category==='REGRESSION')?10:0;return Math.min(100,base+freq+regression);}
function layer(r){if(/SECURITY|PROMPT/.test(r))return 'Prompt + code-level guardrails (1.js / prompt.txt / n8n branch rules)';if(/RETRIEVAL/.test(r))return 'Question matcher / predefined Q&A cache / vector retrieval path';if(/WRONG_ANSWER|MISSING|INCOMPLETE/.test(r))return 'Predefined answer data, KB retrieval, response composition, or prompt rules';if(/HALLUCINATION|UNSUPPORTED/.test(r))return 'Grounding/fallback policy and LLM response generation';if(/TIMEOUT|WEBHOOK|MALFORMED/.test(r))return 'n8n webhook/infrastructure/response-node integration';return 'Needs trace-level review';}
function inferCause(r){if(/HALLUCINATION|UNSUPPORTED/.test(r))return 'Response generation or grounding controls may permit claims not supported by the supplied PMT sources.';if(/RETRIEVAL/.test(r))return 'The matcher/retrieval path may be choosing no result or the wrong source even though expected source material exists.';if(/WRONG_ANSWER|MISSING|INCOMPLETE/.test(r))return 'Answer selection, source coverage, or response composition may be incomplete or incorrect.';if(/PROMPT|SECURITY/.test(r))return 'Prompt/guardrail enforcement may be insufficient for this input class.';if(/TIMEOUT|WEBHOOK|MALFORMED/.test(r))return 'Webhook or an upstream n8n node may be timing out, erroring, or returning an unexpected payload.';return 'Requires review of the request/response trace and source evidence.';}
function recommend(r,arr){if(/HALLUCINATION|UNSUPPORTED/.test(r))return `Tighten grounding and fallback behavior. When the matched PMT source does not contain the requested fact, return the configured fallback instead of completing the answer from model knowledge. Add ${arr.length} affected cases to permanent regression coverage.`;if(/RETRIEVAL/.test(r))return `Inspect semantic matching, paraphrase overrides, Google Sheet/cache precedence, and vector retrieval for ${arr.slice(0,6).map(x=>x.testId).join(', ')}. Fix the smallest matcher/retrieval rule that maps these questions to the intended source.`;if(/WRONG_ANSWER|MISSING|INCOMPLETE/.test(r))return `Compare expected source evidence with the actual answer for ${arr.slice(0,6).map(x=>x.testId).join(', ')}. Correct the relevant predefined answer, KB entry, selection rule, or response-composition instruction without weakening unrelated cases.`;if(/PROMPT|SECURITY/.test(r))return 'Move deterministic protections to code-level guardrails where possible, strengthen the system-prompt refusal rule, and add the exact failing inputs to regression tests.';if(/TIMEOUT|WEBHOOK|MALFORMED/.test(r))return 'Inspect n8n execution logs and the final Respond to Webhook node. Preserve a stable JSON response contract and bound expensive upstream calls.';return 'Review the detailed trace and update only the responsible layer.';}
function mdEscape(s){return String(s??'').replace(/\r/g,'').replace(/```/g,'` ` `');}
function short(s,n=900){const x=mdEscape(s);return x.length>n?x.slice(0,n)+'…':x;}
function evidenceBlock(t){return `### ${t.testId} — ${t.category} — ${t.status}\n\n**Question**\n\n> ${short(t.question,500)}\n\n**Expected behavior/source**\n\n\`\`\`json\n${short(JSON.stringify(t.expected,null,2),1200)}\n\`\`\`\n\n**Actual response**\n\n\`\`\`text\n${short(t.response?.answer||t.rawResponse||'',1200)}\n\`\`\`\n\n**Evaluation**\n\n- Score: ${t.evaluation?.overallScore ?? 0}/100\n- Failure reasons: ${(t.failureReasons||[]).join(', ')||'none'}\n- Status reason: ${short(t.statusReason||'',400)}\n- Latency: ${t.latencyMs??'n/a'} ms\n- Generated from: ${(t.generatedFrom||[]).join(', ')||'rule-based test'}\n`;}
async function aiAdvice(aiProvider,run,patterns){if(!aiProvider?.enabled)return null;try{const failures=run.tests.filter(t=>BAD.has(t.status)).slice(0,35).map(t=>({testId:t.testId,category:t.category,question:t.question,expected:t.expected,actual:t.response?.answer,status:t.status,reasons:t.failureReasons,score:t.evaluation?.overallScore}));return await aiProvider.json([{role:'system',content:'You are analyzing a chatbot QA run. Return strict JSON only: {"issues":[{"title":"...","priority":"CRITICAL|HIGH|MEDIUM|LOW","probableCause":"...","recommendedChange":"...","affectedTests":["TEST-..."]}],"nextSteps":["..."]}. Every recommendation must be supported by the supplied failed tests. Do not invent code, fields, or facts not present in evidence.'},{role:'user',content:JSON.stringify({summary:run.summary,patterns,failures})}],{temperature:0});}catch{return null;}}
export async function writeImprovementReport(config,run,patterns,{aiProvider=null}={}){
  const failed=run.tests.filter(t=>BAD.has(t.status));
  const ai=await aiAdvice(aiProvider,run,patterns);
  const lines=[
    '# CHATBOT IMPROVEMENTS — Coding Agent Handoff',
    '',
    `Generated from automated run: **${run.runId}**`,
    '',
    '## How the coding agent should use this file',
    '',
    '1. Treat the failed-test evidence below as the acceptance criteria.',
    '2. Inspect the supplied n8n workflow, `input/examples/predefined-questions-node.js`, `input/examples/predefined-answers-node.js`, `input/prompts/prompt.txt`, predefined Q&A, and KB before changing behavior.',
    '3. Fix the smallest responsible layer. Do not weaken safety, fallback, or grounding rules to make one test pass.',
    '4. After changes, run `npm start` again and confirm the affected test IDs or equivalent regression questions pass.',
    '5. Do not fabricate PMT facts. If source evidence is missing, improve fallback behavior instead of inventing an answer.',
    '',
    '## Current Health',
    '',
    `- Total tests: ${run.summary.total}`,
    `- Pass rate: ${(run.summary.passRate*100).toFixed(2)}%`,
    `- Average score: ${run.summary.averageScore}/100`,
    `- Hallucination rate: ${(run.summary.hallucinationRate*100).toFixed(2)}%`,
    `- Webhook error rate: ${(run.summary.webhookErrorRate*100).toFixed(2)}%`,
    `- Average latency: ${run.summary.averageLatencyMs} ms`,
    `- Quality gate: **${run.summary.qualityGate.status}**`,
    `- Failed/attention tests: ${failed.length}`,
    '',
    '## Prioritized Problems',
    ''
  ];
  if(!patterns.length)lines.push('No recurring scored failure pattern was found in this run.');
  patterns.forEach((p,i)=>lines.push(`### IMP-${String(i+1).padStart(3,'0')} — ${p.reason}\n\n- Priority: **${p.priority}**\n- Frequency: ${p.count}\n- Responsible layer to inspect: ${p.responsibleLayer}\n- Root-cause confidence: **${p.rootCauseConfidence}**\n- Observed fact: ${p.observedFact}\n- Probable cause: ${p.probableCause}\n- Recommended change: ${p.recommendation}\n- Affected tests: ${p.affectedTests.join(', ')}\n- Expected impact: ${p.expectedImpact}\n`));
  if(ai?.issues?.length){lines.push('','## AI-Assisted Failure Synthesis','');for(const [i,x] of ai.issues.entries())lines.push(`### AI-${String(i+1).padStart(3,'0')} — ${mdEscape(x.title)}\n\n- Priority: **${mdEscape(x.priority)}**\n- Probable cause: ${mdEscape(x.probableCause)}\n- Recommended change: ${mdEscape(x.recommendedChange)}\n- Affected tests: ${(x.affectedTests||[]).join(', ')}\n`);}
  lines.push('','## Failed-Test Evidence','');
  if(!failed.length)lines.push('No failed/partial/error tests in this run.');
  for(const t of failed.slice(0,60))lines.push(evidenceBlock(t));
  lines.push('','## Required Regression Checks','');
  if(!failed.length)lines.push('- Re-run the standard suite after future chatbot changes.');
  else for(const t of failed.slice(0,40))lines.push(`- [ ] Re-test ${t.testId}: ${short(t.question,220)} — expected failure reasons to clear: ${(t.failureReasons||[]).join(', ')||t.status}`);
  lines.push('','## Next Run Priorities','', '- Preserve all currently fixed historical regression cases.', '- Re-run hallucination and prompt-injection tests after prompt or guardrail changes.', '- Re-run KB-derived questions after changing knowledge ingestion/retrieval.', '- Compare pass rate, hallucination rate, and average score against this run.', '');
  if(ai?.nextSteps?.length){lines.push('## Additional AI-Synthesized Next Steps','');for(const x of ai.nextSteps)lines.push(`- ${mdEscape(x)}`);lines.push('');}
  const content=lines.join('\n');
  await fs.writeFile(config.storage.improvementsFile,content,'utf8');
  if(config.storage.improvementHistoryDir){await ensureDir(config.storage.improvementHistoryDir);await fs.writeFile(path.join(config.storage.improvementHistoryDir,`${run.runId}.md`),content,'utf8');}
  return config.storage.improvementsFile;
}
