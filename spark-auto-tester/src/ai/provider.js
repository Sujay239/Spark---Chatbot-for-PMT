import { sleep } from '../utils/concurrency.js';
export class AiProvider {
  constructor(runtime){ this.runtime=runtime; }
  get enabled(){ return Boolean(this.runtime?.enabled&&this.runtime?.baseUrl&&this.runtime?.apiKey&&this.runtime?.model); }
  async json(messages,{temperature=this.runtime?.temperature??0}={}){
    if(!this.enabled) throw new Error('AI provider is not configured');
    const url=this.runtime.baseUrl.replace(/\/$/,'')+'/chat/completions';
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),this.runtime.timeoutMs||45000);
    try{
      const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${this.runtime.apiKey}`},body:JSON.stringify({model:this.runtime.model,temperature,messages,response_format:{type:'json_object'}}),signal:controller.signal});
      const raw=await res.text(); if(!res.ok)throw new Error(`AI HTTP ${res.status}`); let data; try{data=JSON.parse(raw);}catch{throw new Error('AI returned malformed JSON envelope');}
      const content=data?.choices?.[0]?.message?.content; if(typeof content==='object')return content; try{return JSON.parse(content);}catch{throw new Error('AI response content is not strict JSON');}
    } finally { clearTimeout(timer); }
  }
}
