import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ensureDir } from './fs.js';
import { redact } from './security.js';
export function createLogger(logDir, runId) {
  const file=path.join(logDir,`${runId}.log`);
  async function log(level,event,data={}) { await ensureDir(logDir); await fs.appendFile(file,JSON.stringify({timestamp:new Date().toISOString(),level,event,...redact(data)})+'\n'); }
  return { info:(e,d)=>log('info',e,d), warn:(e,d)=>log('warn',e,d), error:(e,d)=>log('error',e,d), file };
}
