import path from 'node:path';
import { promises as fs } from 'node:fs';
import { ensureDir,writeJson,listFilesRecursive,readJson } from '../utils/fs.js';
export async function saveRun(config,run){const file=path.join(config.storage.resultsDir,`run-${run.runId}.json`);await writeJson(file,run);const dir=path.join(config.storage.reportsDir,run.runId);await ensureDir(dir);await writeJson(path.join(dir,'results.json'),run);await writeJson(path.join(dir,'summary.json'),run.summary);return {file,dir};}
export async function previousRun(config,currentRunId=null,mode=null){const files=(await listFilesRecursive(config.storage.resultsDir)).filter(f=>/run-.*\.json$/.test(f)).sort();for(let i=files.length-1;i>=0;i--){try{const r=await readJson(files[i]);if(r.runId!==currentRunId&&(!mode||r.mode===mode))return r;}catch{}}return null;}
export async function loadRun(file){return readJson(file);}
