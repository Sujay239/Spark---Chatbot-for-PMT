const STOP=new Set('a an and are as at be but by for from how i in is it of on or that the this to was what when where which who why with you your can could should would do does did my me our we they their'.split(' '));
export function normalizeText(s=''){ return String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim(); }
export function tokens(s=''){ return [...new Set(normalizeText(s).split(' ').filter(x=>x&&!STOP.has(x)))]; }
function trigramSet(s){ const n=`  ${normalizeText(s)}  `; const set=new Set(); for(let i=0;i<n.length-2;i++)set.add(n.slice(i,i+3)); return set; }
function jaccard(a,b){ if(!a.size&&!b.size)return 1; let i=0; for(const x of a)if(b.has(x))i++; return i/(a.size+b.size-i||1); }
export function semanticSimilarity(a,b){ const ta=new Set(tokens(a)), tb=new Set(tokens(b)); const token=jaccard(ta,tb); const tri=jaccard(trigramSet(a),trigramSet(b)); return Math.max(0,Math.min(1,token*0.7+tri*0.3)); }
export function bestSimilarity(question, corpus){ let best={score:0,item:null}; for(const item of corpus){ const text=typeof item==='string'?item:item.question; const score=semanticSimilarity(question,text); if(score>best.score)best={score,item}; } return best; }
