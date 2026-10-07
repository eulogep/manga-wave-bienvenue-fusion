import assert from 'node:assert/strict';
import test from 'node:test';
import { observeJev, parseAnswer } from '../scripts/experiments/jev-shadow.ts';
const answer={type:'choice',choice:'retry',probabilities:{retry:.95,stop:.05},confidence:.9};
test('valid typed answer is advisory even at high confidence',async()=>{
  const result=await observeJev({state:{},baseline:'stop',apiKey:'test',fetcher:async()=>Response.json({model:'jev-1.13.0',answers:{retry:answer},usage:{input_tokens:100}})});
  assert.equal(result.status,'OBSERVED');assert.equal(result.executedDecision,'stop');assert.equal(result.answer?.choice,'retry');
});
test('absent key makes no call and preserves rules',async()=>{
  const result=await observeJev({state:{},baseline:'stop',fetcher:async()=>{throw new Error('must not call');}});
  assert.equal(result.status,'NOT_CONFIGURED');assert.equal(result.executedDecision,'stop');
});
for(const status of [401,429,500,529]) test(`HTTP ${status} fails over without retries`,async()=>{
  let calls=0; const r=await observeJev({state:{},baseline:'retry',apiKey:'test',fetcher:async()=>{calls++;return new Response('',{status});}});
  assert.equal(calls,1);assert.equal(r.status,`HTTP_${status}`);assert.equal(r.executedDecision,'retry');
});
test('deadline protects against hanging transport',async()=>{
  const r=await observeJev({state:{},baseline:'stop',apiKey:'test',timeoutMs:10,fetcher:()=>new Promise(()=>{})});
  assert.equal(r.status,'TIMEOUT');assert.equal(r.executedDecision,'stop');
});
test('invalid or contradictory distributions fail closed',()=>{
  for(const value of [null,{}, {...answer,choice:'delete'}, {...answer,confidence:NaN},{...answer,probabilities:{retry:1,stop:1}},{...answer,probabilities:{retry:.1,stop:.9}},{...answer,confidence:.95}]) assert.equal(parseAnswer(value),null);
});
test('malformed JSON, network failure and model drift preserve the decision',async()=>{
  const transports: typeof fetch[] = [
    async()=>new Response('not-json'),
    async()=>{throw new Error('private transport detail');},
    async()=>Response.json({model:'jev-future',answers:{retry:answer}}),
  ];
  for(const fetcher of transports) {
    const result=await observeJev({state:{},baseline:'stop',apiKey:'test',fetcher});
    assert.equal(result.executedDecision,'stop');assert.equal(result.answer,null);
    assert.ok(!JSON.stringify(result).includes('private transport detail'));
  }
});
