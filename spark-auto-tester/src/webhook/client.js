import { sleep } from '../utils/concurrency.js';
import { normalizeResponse } from './normalizer.js';
import { redact, redactUrl } from '../utils/security.js';
export class WebhookClient{
  constructor(config){this.target=config.target;this.exec=config.execution;}
  buildRequest(question,sessionId){
    const t=this.target; const payload={...(t.request.staticFields||{}),[t.request.questionField]:question,[t.request.sessionField]:sessionId};
    let url=t.url; const init={method:t.method,headers:{...t.headers}};
    if(t.request.location==='query'||t.method==='GET') {const u=new URL(url);for(const [k,v] of Object.entries(payload))u.searchParams.set(k,String(v??''));url=u.toString();}
    else {init.headers['content-type']=init.headers['content-type']||'application/json'; init.body=JSON.stringify(payload);}
    return {url,init,payload};
  }
  async send(question,sessionId){
    const req=this.buildRequest(question,sessionId); const attempts=[]; const started=Date.now(); let lastError=null;
    for(let attempt=0;attempt<=this.exec.maxRetries;attempt++){
      const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),this.exec.requestTimeoutMs);
      const aStart=Date.now();
      try{
        const res=await fetch(req.url,{...req.init,signal:controller.signal}); const raw=await res.text(); const latency=Date.now()-aStart;
        attempts.push({attempt:attempt+1,httpStatus:res.status,latencyMs:latency});
        if(this.exec.retryStatusCodes.includes(res.status)&&attempt<this.exec.maxRetries){await sleep(this.exec.backoffBaseMs*(2**attempt));continue;}
        return {request:redact({method:req.init.method,url:redactUrl(req.url),headers:req.init.headers,payload:req.payload}),httpStatus:res.status,headers:Object.fromEntries(res.headers),response:normalizeResponse(raw,res.headers.get('content-type')||'',this.target.response),rawResponse:raw,latencyMs:Date.now()-started,error:res.ok?null:`HTTP_${res.status}`,attempts};
      }catch(e){
        const timeout=e?.name==='AbortError'; lastError=timeout?'TIMEOUT':`NETWORK_ERROR:${e.message}`; attempts.push({attempt:attempt+1,error:lastError,latencyMs:Date.now()-aStart});
        if(attempt<this.exec.maxRetries){await sleep(this.exec.backoffBaseMs*(2**attempt));continue;}
      }finally{clearTimeout(timer);}
    }
    return {request:redact({method:req.init.method,url:redactUrl(req.url),headers:req.init.headers,payload:req.payload}),httpStatus:null,headers:{},response:{answer:null,sources:[],confidence:null,intent:null,metadata:{},rawResponse:null,rawText:null},rawResponse:null,latencyMs:Date.now()-started,error:lastError||'UNKNOWN_NETWORK_ERROR',attempts};
  }
}
