import path from 'node:path';
import { analyzeInputs } from '../ingestion/analyze.js';
import { AiProvider } from '../ai/provider.js';
import { generateTests } from '../test-generation/generator.js';
import { loadQuestionHistory, appendQuestionHistory } from '../test-generation/history.js';
import { WebhookClient } from '../webhook/client.js';
import { MockWebhookClient } from '../mock/mock-webhook.js';
import { executeTests } from '../test-execution/executor.js';
import { runId as makeRunId } from '../utils/ids.js';
import { createLogger } from '../utils/logger.js';
import { summarize, coverage } from '../analytics/summary.js';
import { saveRun, previousRun } from '../storage/run-store.js';
import { loadRegression, activeRegression, updateRegression } from '../regression/regression-store.js';
import { analyzeFailures, writeImprovementReport } from '../improvement/analyzer.js';
import { generateHtmlReport } from '../reporting/html.js';
import { writeJson } from '../utils/fs.js';

export async function generateOnly(config,{dryRun=true}={}){
  const spec=await analyzeInputs(config),ai=new AiProvider(config.ai.runtime),regression=activeRegression(await loadRegression(config)),history=await loadQuestionHistory(config);
  const tests=await generateTests(spec,config,{aiProvider:ai,regressionCases:regression,previousGenerated:history,seed:`dry-${Date.now()}`});
  const file=path.join(config.root,'artifacts','generated-tests.json');await writeJson(file,{generatedAt:new Date().toISOString(),dryRun,tests});return {spec,tests,file};
}
export async function runFull(config,{mock=false,onProgress}={}){
  const rid=makeRunId(),startedAt=new Date().toISOString(),logger=createLogger(config.storage.logsDir,rid);await logger.info('run_started',{runId:rid,mock});
  onProgress?.({type:'stage',stage:'analyze',message:'Analyzing knowledge base, predefined Q&A, prompt, and workflow'});
  const spec=await analyzeInputs(config),ai=new AiProvider(config.ai.runtime),regression=activeRegression(await loadRegression(config)),history=await loadQuestionHistory(config);
  onProgress?.({type:'stage',stage:'generate',message:'Generating unique questions from Q&A and knowledge base'});
  const tests=await generateTests(spec,config,{aiProvider:ai,regressionCases:regression,previousGenerated:history,seed:rid});
  await appendQuestionHistory(config,tests,{runId:rid});
  await writeJson(path.join(config.root,'artifacts','generated-tests.json'),{runId:rid,generatedAt:new Date().toISOString(),tests});
  onProgress?.({type:'generated',count:tests.length,tests});
  const client=mock?new MockWebhookClient(spec):new WebhookClient(config);
  onProgress?.({type:'stage',stage:'execute',message:'Sending questions to the chatbot sequentially, one request at a time'});
  const results=await executeTests(tests,client,config,{runId:rid,aiProvider:ai,spec,logger,onProgress});
  const prev=await previousRun(config,rid,mock?'mock':'live'),completedAt=new Date().toISOString(),summary=summarize(results,config.qualityGates,prev?.summary),cov=coverage(results,spec);
  const run={runId:rid,startedAt,completedAt,mode:mock?'mock':'live',configuration:{testing:config.testing,execution:config.execution,evaluation:config.evaluation,qualityGates:config.qualityGates,target:{method:config.target.method,url:config.target.url,request:config.target.request,response:config.target.response},ai:{enabled:ai.enabled,model:ai.enabled?config.ai.runtime.model:null}},versions:{knowledgeBaseVersion:spec.versions?.knowledgeBaseVersion||null,qaVersion:spec.versions?.qaVersion||null,chatbotPromptVersion:spec.versions?.promptsVersion||null,workflowVersion:spec.versions?.workflowVersion||null,evaluationVersion:'1.1.0',testerVersion:'2.0.0'},summary,coverage:cov,tests:results};
  onProgress?.({type:'stage',stage:'save',message:'Saving full run JSON'});
  const saved=await saveRun(config,run);
  onProgress?.({type:'stage',stage:'report',message:'Generating HTML dashboard'});
  const report=await generateHtmlReport(run,config),patterns=analyzeFailures(results);
  onProgress?.({type:'stage',stage:'improvements',message:'Scanning failures and generating coding-agent improvement Markdown'});
  const improvements=await writeImprovementReport(config,run,patterns,{aiProvider:ai});
  if(!mock)await updateRegression(config,run);
  await logger.info('run_completed',{summary,report,improvements});
  onProgress?.({type:'done',run,report,improvements});
  return {run,saved,report,patterns,improvements};
}
