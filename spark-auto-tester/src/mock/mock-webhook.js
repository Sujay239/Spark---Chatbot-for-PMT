import { semanticSimilarity } from '../semantic/similarity.js';
export class MockWebhookClient{
  constructor(spec){this.qa=spec.qa||[];this.i=0;}
  async send(question,sessionId){ const i=this.i++; const mode=i%8; const best=this.qa.map(x=>({x,s:semanticSimilarity(question,x.question)})).sort((a,b)=>b.s-a.s)[0]; let answer=best?.x?.answer||"Sorry, I couldn't find a relevant answer for your question."; let error=null,httpStatus=200,raw;
    if(mode===1&&answer)answer=answer.split(/[.!?]/).slice(0,1).join('.')+'.';
    if(mode===2)answer='This is definitely guaranteed to cure all pain permanently.';
    if(mode===3)answer="Sorry, I couldn't find a relevant answer for your question.";
    if(mode===4){error='TIMEOUT';httpStatus=null;answer=null;}
    if(mode===5){error='HTTP_503';httpStatus=503;answer=null;}
    if(mode===6){raw='{malformed';answer=null;}
    else raw=JSON.stringify({text:answer});
    return {request:{method:'MOCK',url:'mock://chatbot',payload:{chatInput:question,sessionId}},httpStatus,headers:{'content-type':'application/json'},response:{answer,sources:[],confidence:null,intent:null,metadata:{mock:true},rawResponse:raw,rawText:raw},rawResponse:raw,latencyMs:20+(i%30),error,attempts:[{attempt:1,httpStatus}]}; }
}
