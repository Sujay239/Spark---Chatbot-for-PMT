import { promises as fs } from 'node:fs';
import path from 'node:path';

function parseCsvLine(line) {
  const out=[]; let cur=''; let q=false;
  for (let i=0;i<line.length;i++) { const c=line[i]; if (c==='"') { if(q && line[i+1]==='"'){cur+='"';i++;} else q=!q; } else if(c===','&&!q){out.push(cur);cur='';} else cur+=c; }
  out.push(cur); return out;
}
export function parseCsv(raw) {
  const lines=raw.replace(/^\uFEFF/,'').split(/\r?\n/); if(!lines.length) return [];
  // support embedded newlines inside quoted fields
  const records=[]; let buf=''; let quoteCount=0;
  for (const line of lines) { buf += (buf?'\n':'')+line; quoteCount += (line.match(/"/g)||[]).length; if (quoteCount%2===0){ records.push(parseCsvLine(buf)); buf=''; quoteCount=0; } }
  const header=(records.shift()||[]).map(x=>x.trim());
  return records.filter(r=>r.some(x=>x.trim())).map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]??''])));
}
export async function parseFile(file) {
  const ext=path.extname(file).toLowerCase(); const raw=await fs.readFile(file,'utf8');
  if(ext==='.json') return {type:'json',data:JSON.parse(raw),raw};
  if(ext==='.csv') return {type:'csv',data:parseCsv(raw),raw};
  return {type:'text',data:raw,raw};
}
