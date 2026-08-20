function norm(s=''){ return String(s).trim().replace(/\s+/g,' ').toLowerCase(); }
export function detectQaConflicts(qa) {
  const map=new Map(); const conflicts=[];
  for (const x of qa) { const k=norm(x.question); if(!k)continue; if(!map.has(k))map.set(k,[]); map.get(k).push(x); }
  for (const [question,rows] of map) {
    const answers=[...new Set(rows.map(x=>norm(x.answer)).filter(Boolean))];
    if(answers.length>1) conflicts.push({type:'QA_CONFLICT',question,sourceRefs:rows.map(x=>x.sourceRef),answers:rows.map(x=>x.answer)});
  }
  return conflicts;
}
export function detectKbConflicts(entries) {
  // Conservative: only flag identical URL+heading carrying materially different content.
  const map=new Map(), out=[];
  for (const e of entries) { const k=`${norm(e.url)}|${norm(e.heading)}`; if(!map.has(k)) map.set(k,[]); map.get(k).push(e); }
  for (const [key,rows] of map) if(rows.length>1) {
    const contents=[...new Set(rows.map(r=>norm(r.content)))]; if(contents.length>1) out.push({type:'KB_DUPLICATE_CONFLICT',key,sourceRefs:rows.map(r=>r.sourceRef)});
  }
  return out;
}
