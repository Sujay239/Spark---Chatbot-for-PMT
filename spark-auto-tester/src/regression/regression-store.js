import path from 'node:path';
import { readJson,writeJson,exists } from '../utils/fs.js';
const BAD=new Set(['FAILED','PARTIAL','HALLUCINATION','UNSAFE','OFF_TOPIC','INVALID']);
export async function loadRegression(config){const file=path.join(config.storage.regressionDir,'cases.json');if(!await exists(file))return [];const d=await readJson(file);return Array.isArray(d)?d:(d.cases||[]);}
export async function updateRegression(config,run){const file=path.join(config.storage.regressionDir,'cases.json');const current=await loadRegression(config);const map=new Map(current.map(x=>[x.fingerprint||x.question,x]));
  for(const t of run.tests){const key=t.fingerprint||`${t.category}|${t.question}`;const old=map.get(key);if(BAD.has(t.status)){map.set(key,{...pick(t),fingerprint:key,firstFailedAt:old?.firstFailedAt||run.completedAt,lastFailedAt:run.completedAt,lastStatus:t.status,timesFailed:(old?.timesFailed||0)+1,fixedAt:null});}else if(old&&old.fixedAt==null){map.set(key,{...old,lastStatus:t.status,fixedAt:run.completedAt});}}
  const all=[...map.values()].sort((a,b)=>(b.timesFailed||0)-(a.timesFailed||0));await writeJson(file,{updatedAt:run.completedAt,cases:all});return all;
}
function pick(t){return {question:t.question,category:t.category,source:t.source,expected:t.expected,generatedFrom:t.generatedFrom,generationStrategy:t.generationStrategy,sessionId:null};}
export function activeRegression(cases){return cases.filter(x=>!x.fixedAt||['FAILED','PARTIAL','HALLUCINATION','UNSAFE','OFF_TOPIC','INVALID'].includes(x.lastStatus));}
