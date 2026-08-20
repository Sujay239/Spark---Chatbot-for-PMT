import { heuristicEvaluate } from './heuristic-evaluator.js';
import { llmEvaluate } from './llm-evaluator.js';
export async function evaluateResponse(test,exchange,{aiProvider=null,spec=null}={}){
  if(exchange.error==='TIMEOUT'||String(exchange.error).includes('TIMEOUT'))return {correctness:0,completeness:0,relevance:0,groundedness:0,intentMatch:0,instructionFollowing:0,overallScore:0,reasons:['TIMEOUT'],explanation:'Webhook timed out.'};
  if(exchange.error&&String(exchange.error).startsWith('HTTP_'))return {correctness:0,completeness:0,relevance:0,groundedness:0,intentMatch:0,instructionFollowing:0,overallScore:0,reasons:['WEBHOOK_ERROR'],explanation:exchange.error};
  const h=heuristicEvaluate(test,exchange.response);
  if(!aiProvider?.enabled)return h;
  try{const context=test.source?.answer||test.source?.content||''; const ai=await llmEvaluate(aiProvider,test,exchange.response,context); ai.heuristic=h; return ai;}catch(e){return {...h,evaluatorWarning:`AI evaluator failed: ${e.message}`};}
}
