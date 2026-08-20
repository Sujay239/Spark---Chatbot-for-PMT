import { promises as fs } from 'node:fs';
export async function loadDotEnv(file='.env') {
  try {
    const raw=await fs.readFile(file,'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const s=line.trim(); if (!s || s.startsWith('#')) continue;
      const i=s.indexOf('='); if (i<0) continue;
      const k=s.slice(0,i).trim(); let v=s.slice(i+1).trim();
      if ((v.startsWith('"')&&v.endsWith('"')) || (v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
      if (!(k in process.env)) process.env[k]=v;
    }
  } catch (e) { if (e.code!=='ENOENT') throw e; }
}
export function envBool(name, fallback=false) {
  const v=process.env[name]; if (v==null) return fallback; return /^(1|true|yes|on)$/i.test(v);
}
export function envNum(name, fallback) { const n=Number(process.env[name]); return Number.isFinite(n)?n:fallback; }
