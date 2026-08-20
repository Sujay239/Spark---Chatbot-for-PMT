#!/usr/bin/env node
import path from 'node:path';
import { loadConfig } from '../config/load-config.js';
import { analyzeInputs } from '../ingestion/analyze.js';
import { generateOnly,runFull } from './pipeline.js';
import { loadRun,previousRun } from '../storage/run-store.js';
import { generateHtmlReport } from '../reporting/html.js';
import { loadRegression,activeRegression } from '../regression/regression-store.js';
import { evaluateResponse } from '../evaluation/evaluator.js';
import { classify } from '../classification/classifier.js';
import { AiProvider } from '../ai/provider.js';
import { summarize,coverage } from '../analytics/summary.js';
import { writeJson } from '../utils/fs.js';

const args=process.argv.slice(2); const command=args[0]||'help'; const flag=n=>args.includes(n); const value=n=>{const i=args.indexOf(n);return i>=0?args[i+1]:null}; const root=path.resolve(value('--root')||process.cwd());
const cfg=await loadConfig(root,value('--config')||'chatbot-tester.config.json');
try{
  if(command==='analyze'){const spec=await analyzeInputs(cfg); console.log(JSON.stringify({status:'OK',qa:spec.qa.length,knowledgeBase:spec.knowledgeBase.length,conflicts:spec.conflicts.length,artifact:'artifacts/system-spec.json'},null,2));process.exit(0);}
  if(command==='generate'){const x=await generateOnly(cfg,{dryRun:flag('--dry-run')});console.log(JSON.stringify({status:'OK',count:x.tests.length,file:path.relative(root,x.file)},null,2));process.exit(0);}
  if(command==='run'){const x=await runFull(cfg,{mock:flag('--mock')});console.log(JSON.stringify({runId:x.run.runId,mode:x.run.mode,qualityGate:x.run.summary.qualityGate,summary:x.run.summary,report:path.relative(root,x.report)},null,2));process.exit(x.run.summary.qualityGate.status==='PASSED'?0:1);}
  if(command==='report'){let file=value('--file');let run;if(file)run=await loadRun(path.resolve(root,file));else run=await previousRun(cfg);if(!run)throw new Error('No result run found');const f=await generateHtmlReport(run,cfg);console.log(f);process.exit(0);}
  if(command==='regression'){const all=await loadRegression(cfg),active=activeRegression(all);console.log(JSON.stringify({total:all.length,active:active.length,cases:active},null,2));process.exit(0);}
  if(command==='evaluate'){const file=value('--file');if(!file)throw new Error('--file is required');const run=await loadRun(path.resolve(root,file));const spec=await analyzeInputs(cfg);const ai=new AiProvider(cfg.ai.runtime);for(const t of run.tests){t.evaluation=await evaluateResponse(t,{error:t.error,response:t.response},{aiProvider:ai,spec});const c=classify(t,{error:t.error,response:t.response},t.evaluation,cfg);t.status=c.status;t.statusReason=c.reason;t.failureReasons=t.evaluation.reasons||[];}const prev=await previousRun(cfg,run.runId);run.summary=summarize(run.tests,cfg.qualityGates,prev?.summary);run.coverage=coverage(run.tests,spec);await writeJson(path.resolve(root,file),run);console.log(JSON.stringify(run.summary,null,2));process.exit(run.summary.qualityGate.status==='PASSED'?0:1);}
  console.log(`chatbot-tester commands:\n  analyze\n  generate --dry-run\n  run [--mock]\n  evaluate --file results/run-....json\n  report [--file results/run-....json]\n  regression\n\nExit codes: 0 quality gates passed/success, 1 quality gates failed, 2 infrastructure/configuration error.`);process.exit(0);
}catch(e){console.error(JSON.stringify({error:e.message,stack:process.env.DEBUG?e.stack:undefined},null,2));process.exit(2);}
