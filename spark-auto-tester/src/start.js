#!/usr/bin/env node
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { loadConfig } from './config/load-config.js';
import { runFull } from './cli/pipeline.js';
import { ensureDir } from './utils/fs.js';
import { startDashboardServer } from './server/dashboard-server.js';

const root=process.cwd();
const cfg=await loadConfig(root,'chatbot-tester.config.json');
const mock=process.argv.includes('--mock');
const noServer=process.argv.includes('--no-server');
const noOpen=process.argv.includes('--no-open');

console.log('');
console.log('============================================================');
console.log(' SPARK AUTOMATED CHATBOT QA + CONTINUOUS IMPROVEMENT RUNNER');
console.log('============================================================');
console.log(`Mode: ${mock?'MOCK':'LIVE WEBHOOK'}`);
console.log(`Webhook: ${cfg.target.url}`);
console.log(`Questions per cycle: ${cfg.testing.questionsPerCycle}`);
console.log('Execution: STRICTLY SEQUENTIAL (1 request at a time)');
console.log('');

function progress(e){
  if(e.type==='stage')console.log(`\n[${e.stage.toUpperCase()}] ${e.message}`);
  if(e.type==='generated')console.log(`Generated ${e.count} tests. New knowledge/Q&A questions are checked against previous generated-question history.`);
  if(e.type==='test-start')console.log(`\n[${String(e.index+1).padStart(3,'0')}/${e.total}] ${e.test.testId} ${e.test.category}\nQ: ${String(e.test.question||'[empty]').replace(/\s+/g,' ').slice(0,240)}`);
  if(e.type==='test-complete')console.log(`A: ${String(e.result.response?.answer||e.result.error||'[no answer]').replace(/\s+/g,' ').slice(0,220)}\n=> ${e.result.status} | score ${e.result.evaluation?.overallScore??0} | ${e.result.latencyMs??'n/a'} ms`);
}

try{
  const x=await runFull(cfg,{mock,onProgress:progress});
  const runDir=path.join(root,'output','runs',x.run.runId),latest=path.join(root,'output','latest');
  await ensureDir(runDir);await fs.rm(latest,{recursive:true,force:true});await ensureDir(latest);
  const generated=path.join(root,'artifacts','generated-tests.json');
  const resultFile=x.saved.file;
  const copies=[
    [x.report,path.join(runDir,'index.html')],[resultFile,path.join(runDir,'results.json')],[x.improvements,path.join(runDir,'CHATBOT_IMPROVEMENTS.md')],[generated,path.join(runDir,'generated-questions.json')],
    [x.report,path.join(latest,'index.html')],[resultFile,path.join(latest,'results.json')],[x.improvements,path.join(latest,'CHATBOT_IMPROVEMENTS.md')],[generated,path.join(latest,'generated-questions.json')]
  ];
  for(const [src,dst] of copies)await fs.copyFile(src,dst);
  await writeLandingMeta(latest,x.run);
  console.log('\n============================================================');
  console.log(' RUN COMPLETE');
  console.log('============================================================');
  console.log(`Run ID: ${x.run.runId}`);
  console.log(`Pass rate: ${(x.run.summary.passRate*100).toFixed(2)}%`);
  console.log(`Average score: ${x.run.summary.averageScore}/100`);
  console.log(`Quality gate: ${x.run.summary.qualityGate.status}`);
  console.log(`Results JSON: output/latest/results.json`);
  console.log(`HTML dashboard: output/latest/index.html`);
  console.log(`Coding-agent improvement file: output/latest/CHATBOT_IMPROVEMENTS.md`);
  console.log(`Generated question set: output/latest/generated-questions.json`);
  if(!noServer)startDashboardServer(path.join(root,'output'),{port:Number(process.env.DASHBOARD_PORT||3000),openBrowser:!noOpen});
  else process.exit(x.run.summary.qualityGate.status==='PASSED'?0:1);
}catch(error){console.error('\nRUN FAILED:',error?.stack||error?.message||error);process.exit(2);}

async function writeLandingMeta(latest,run){
  const meta={runId:run.runId,completedAt:run.completedAt,summary:run.summary};
  await fs.writeFile(path.join(latest,'run-meta.json'),JSON.stringify(meta,null,2)+'\n','utf8');
}
