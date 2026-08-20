function get(obj,path){return path.split('.').reduce((a,k)=>a==null?undefined:a[k],obj);}
export function parseMaybeJson(raw){ if(raw==null||raw==='')return null; if(typeof raw!=='string')return raw; const s=raw.trim(); if(!s)return null; try{return JSON.parse(s);}catch{}
  // nested/stringified JSON
  if((s.startsWith('"{')||s.startsWith("'{"))){try{return JSON.parse(JSON.parse(s));}catch{}}
  return raw;
}
export function normalizeResponse(rawBody,contentType='',cfg={}){
  const parsed=parseMaybeJson(rawBody); let answer=null,sources=null,intent=null,confidence=null,metadata={};
  if(typeof parsed==='string') answer=parsed;
  else if(parsed&&typeof parsed==='object'){
    for(const p of cfg.answerPaths||[]) {const v=get(parsed,p); if(v!=null){answer=typeof v==='string'?v:JSON.stringify(v);break;}}
    for(const p of cfg.sourcePaths||[]) {const v=get(parsed,p);if(v!=null){sources=v;break;}}
    for(const p of cfg.intentPaths||[]) {const v=get(parsed,p);if(v!=null){intent=v;break;}}
    for(const p of cfg.confidencePaths||[]) {const v=get(parsed,p);if(v!=null){confidence=v;break;}}
    metadata=Object.fromEntries(Object.entries(parsed).filter(([k])=>!['text','answer','output','response','sources','intent','confidence'].includes(k)));
  }
  return {answer:answer??null,sources:sources??[],confidence:confidence??null,intent:intent??null,metadata,rawResponse:parsed,rawText:typeof rawBody==='string'?rawBody:JSON.stringify(rawBody),contentType};
}
