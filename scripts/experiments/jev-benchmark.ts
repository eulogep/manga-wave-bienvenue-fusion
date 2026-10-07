import { writeFile } from 'node:fs/promises';
import { ProviderHttpClient, ProviderHttpError } from '../../server/src/lib/provider-http.ts';
import { observeJev } from './jev-shadow.ts';

// Minimal, documented historical STATUS replays. No fabricated per-request telemetry.
// These reports are not a representative, independently adjudicated gold dataset.
const cases = [
  { id:'anilist-service-disabled', provider:'anilist', status:403, label:'stop' as const, evidence:'MANGA_WAVE_V3_T3020_REPORT.md:271' },
  { id:'jikan-mal-timeout', provider:'jikan', status:504, label:'retry' as const, evidence:'MANGA_WAVE_V3_T3020_REPORT.md:271' },
  { id:'mangakakalot-cloudflare', provider:'mangakakalot', status:522, label:'retry' as const, evidence:'MANGA_WAVE_V3_P4_PROVIDER_RESILIENCE_REPORT.md:35', limitation:'Transport classification only; provider disabled in production, no request must be executed.' },
];
const live = process.argv.includes('--live');
if (live && !process.env.TYPESAFE_API_KEY) throw new Error('TYPESAFE_API_KEY absent; no call made.');
const output = process.argv.find(x => x.startsWith('--out='))?.slice(6);
type Observation = Awaited<ReturnType<typeof observeJev>> & {
  id: string; repeat: number; label: 'retry' | 'stop'; baseline: 'retry' | 'stop'; baselineMs: number;
};
const rows: Observation[] = [];
for (const item of cases) {
  for (let repeat=0; repeat<5; repeat++) {
    const client = new ProviderHttpClient({ fetch:async()=>new Response('',{status:item.status}), sleep:async()=>{} });
    const start=performance.now(); let baseline: 'retry'|'stop'='stop';
    try { await client.getText('https://historical-replay.invalid/status',{minIntervalMs:0,maxRetries:0}); }
    catch(error) { if (!(error instanceof ProviderHttpError)) throw error; baseline=error.retryable?'retry':'stop'; }
    const baselineMs=performance.now()-start;
    const observed=await observeJev({state:{provider:item.provider,http_status:item.status,remaining_retry_budget:2},baseline,apiKey:live?process.env.TYPESAFE_API_KEY:undefined});
    rows.push({id:item.id,repeat,label:item.label,baseline,baselineMs,...observed});
  }
}
const measured=rows.filter(row=>row.answer);
const percentile=(values:number[],p:number)=>values.length?[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.ceil(values.length*p)-1)]:null;
const positives=measured.filter(x=>x.label==='retry'); const negatives=measured.filter(x=>x.label==='stop');
const result={date:new Date().toISOString(),scope:'3 historical status replays x5, not full production decisions',cases,
  rules:{accuracy:rows.filter(x=>x.baseline===x.label).length/rows.length,p50Ms:percentile(rows.map(x=>x.baselineMs),.5),p95Ms:percentile(rows.map(x=>x.baselineMs),.95),remoteCostUsd:0,repeatAgreement:cases.every(c=>new Set(rows.filter(x=>x.id===c.id).map(x=>x.baseline)).size===1)},
  jev:{status:live?'ATTEMPTED':'NOT_CONFIGURED',observations:measured.length,totalAttempts:live?rows.length:0,
    accuracy:measured.length?measured.filter(x=>x.answer!.choice===x.label).length/measured.length:null,
    p50Ms:percentile(measured.map(x=>x.elapsedMs),.5),p95Ms:percentile(measured.map(x=>x.elapsedMs),.95),
    estimatedCostUsd:measured.length && measured.every(x=>x.inputTokens!==null)?measured.reduce((n,x)=>n+x.inputTokens!,0)*.042/1e6:null,
    falsePositiveRate:negatives.length?negatives.filter(x=>x.answer!.choice==='retry').length/negatives.length:null,
    falseNegativeRate:positives.length?positives.filter(x=>x.answer!.choice==='stop').length/positives.length:null,
    brier:measured.length?measured.reduce((sum,x)=>sum+(x.answer!.probabilities.retry-Number(x.label==='retry'))**2,0)/measured.length:null,
    repeatAgreement:measured.length===rows.length?cases.every(c=>new Set(measured.filter(x=>x.id===c.id).map(x=>JSON.stringify(x.answer))).size===1):null},
  autonomyThreshold:null,secondaryThreshold:null,calibration:'INSUFFICIENT_DATA',llm:'NOT_RUN_OPTIONAL',classification:'EXPERIMENTAL',rows};
if(output) await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,rows:undefined},null,2));
