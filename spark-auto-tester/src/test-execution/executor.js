import { mapControlled } from '../utils/concurrency.js';
import { evaluateResponse } from '../evaluation/evaluator.js';
import { classify } from '../classification/classifier.js';
async function runExchange(test,client,sessionId){
  if(!Array.isArray(test.turns)||!test.turns.length)return {exchange:await client.send(test.question,sessionId),turnResults:null};
  const turnResults=[];let exchange=null;
  for(const turn of test.turns){exchange=await client.send(turn.question,sessionId);turnResults.push({question:turn.question,expected:turn.expected,exchange});if(exchange.error)break;}
  return {exchange,turnResults};
}
export async function executeTests(tests,client,config,{runId,aiProvider,spec,logger,onProgress}={}){
  let completed=0;
  return mapControlled(tests,async(test,index)=>{
    const sessionId=test.sessionId||`${runId}-${test.testId}`,timestamp=new Date().toISOString();
    await logger?.info('test_started',{testId:test.testId,category:test.category});
    onProgress?.({type:'test-start',index,total:tests.length,test});
    const {exchange,turnResults}=await runExchange(test,client,sessionId);
    const evaluation=await evaluateResponse(test,exchange,{aiProvider,spec}),cls=classify(test,exchange,evaluation,config);
    const result={...test,sessionId,timestamp,request:exchange?.request??null,httpStatus:exchange?.httpStatus??null,response:{...(exchange?.response||{}),raw:exchange?.response?.rawResponse},rawResponse:exchange?.rawResponse??null,evaluation,status:cls.status,statusReason:cls.reason,failureReasons:evaluation.reasons||[],latencyMs:exchange?.latencyMs??null,error:exchange?.error??null,attempts:exchange?.attempts??[],turnResults};
    completed++;
    await logger?.info('test_completed',{testId:test.testId,status:result.status,score:evaluation.overallScore,latencyMs:result.latencyMs});
    onProgress?.({type:'test-complete',index,completed,total:tests.length,test,result});
    return result;
  },config.execution);
}
