import path from 'node:path';
import { readJson } from '../utils/fs.js';
import { loadDotEnv, envBool, envNum } from '../utils/env.js';

export async function loadConfig(root=process.cwd(), configFile='chatbot-tester.config.json') {
  await loadDotEnv(path.join(root,'.env'));
  const cfg=await readJson(path.join(root,configFile));
  const t=cfg.target, e=cfg.execution, test=cfg.testing, ai=cfg.ai;
  t.url=process.env[t.urlEnv] || t.defaultUrl;
  t.method=(process.env[t.methodEnv] || t.defaultMethod || 'GET').toUpperCase();
  const authName=process.env[t.auth?.headerNameEnv||'']; const authValue=process.env[t.auth?.valueEnv||''];
  if (authName && authValue) t.headers={...t.headers,[authName]:authValue};
  test.questionsPerCycle=envNum('TEST_COUNT',test.questionsPerCycle);
  test.similarityThreshold=envNum('SIMILARITY_THRESHOLD',test.similarityThreshold);
  for (const [envName,key] of [
    ['ENABLE_NEGATIVE_TESTS','enableNegativeTests'],['ENABLE_HALLUCINATION_TESTS','enableHallucinationTests'],
    ['ENABLE_PROMPT_INJECTION_TESTS','enablePromptInjectionTests'],['ENABLE_EDGE_CASES','enableEdgeCases'],
    ['ENABLE_MULTI_TURN_TESTS','enableMultiTurnTests'],['ENABLE_REGRESSION_TESTS','enableRegressionTests']]) test[key]=envBool(envName,test[key]);
  e.requestTimeoutMs=envNum('REQUEST_TIMEOUT_MS',e.requestTimeoutMs); e.maxRetries=envNum('MAX_RETRIES',e.maxRetries);
  e.requestsPerSecond=envNum('REQUESTS_PER_SECOND',e.requestsPerSecond); e.delayMs=envNum('DELAY_BETWEEN_REQUESTS_MS',e.delayMs);
  e.concurrency=envNum('MAX_CONCURRENT_REQUESTS',e.concurrency);
  cfg.ai.runtime={ enabled: envBool(ai.enabledEnv,false), baseUrl:process.env[ai.baseUrlEnv]||'', apiKey:process.env[ai.apiKeyEnv]||'', model:process.env[ai.modelEnv]||'', temperature:envNum(ai.temperatureEnv,0), timeoutMs:envNum(ai.timeoutEnv,45000)};
  cfg.root=root;
  for (const key of Object.keys(cfg.storage)) if (key.endsWith('Dir') || key.endsWith('File')) cfg.storage[key]=path.resolve(root,cfg.storage[key]);
  return cfg;
}
