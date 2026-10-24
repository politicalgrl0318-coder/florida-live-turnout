import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {reconcileTurnout,RECONCILIATION_VERSION,COUNTY_NAMES,isCurrentGeneral} from '../app/general/county-reports.ts';
const origin='https://florida-live-turnout.politicalgrl0318.workers.dev';
const directory='verification/live-turnout';
await fs.mkdir(directory,{recursive:true});
let html='',deployed=false;
// Wait only for this already-triggered deployment; no future monitoring job.
for(let attempt=0;attempt<18;attempt++){
 try{
  const response=await fetch(`${origin}/general?verify=${RECONCILIATION_VERSION}-${Date.now()}`,{signal:AbortSignal.timeout(20000),cache:'no-store'});
  html=await response.text();
  if(response.ok&&html.includes(`data-reconciliation-version="${RECONCILIATION_VERSION}"`)){deployed=true;break;}
 }catch(error){console.log('Deployment read:',String(error));}
 await new Promise(resolve=>setTimeout(resolve,10000));
}
assert.ok(deployed,'The expected reconciliation version was not verified on the public production page.');
await fs.writeFile(`${directory}/production.html`,html);
const checkedAt=new Date().toISOString(),stamp=Date.now();
const batches=await Promise.allSettled(Array.from({length:5},async(_,batch)=>{
 const response=await fetch(`${origin}/api/general-turnout?batch=${batch}&t=${stamp}`,{signal:AbortSignal.timeout(45000),cache:'no-store'});
 assert.ok(response.ok,`Batch ${batch}: HTTP ${response.status}`);
 const payload=await response.json();
 assert.ok(isCurrentGeneral(payload.electionName,payload.electionDate),`Batch ${batch}: wrong election`);
 assert.ok(Array.isArray(payload.counties),`Batch ${batch}: invalid county rows`);
 await fs.writeFile(`${directory}/batch-${batch}.json`,JSON.stringify(payload,null,2));
 return payload;
}));
let state=null,stateError='';
try{
 const response=await fetch(`${origin}/api/general?t=${stamp}`,{signal:AbortSignal.timeout(20000),cache:'no-store'});
 assert.ok(response.ok,`State: HTTP ${response.status}`);state=await response.json();
 assert.equal(String(state.electionNumber),'49894');
 await fs.writeFile(`${directory}/state.json`,JSON.stringify(state,null,2));
}catch(error){stateError=String(error);}
const rows=batches.flatMap(b=>b.status==='fulfilled'?b.value.counties:[]);
const selected=reconcileTurnout(rows,state,Date.now());
assert.ok(selected.reconciled,'Production selection failed party/method reconciliation');
assert.equal(selected.coverage.inventory,Object.keys(COUNTY_NAMES).length);
await fs.writeFile(`${directory}/selected.json`,JSON.stringify(selected,null,2));
const summary={productionVersion:RECONCILIATION_VERSION,productionMarkerVerified:deployed,checkedAt,finishedAt:new Date().toISOString(),batches:batches.map((b,i)=>({batch:i,status:b.status,error:b.status==='rejected'?String(b.reason):undefined,counties:b.status==='fulfilled'?b.value.counties.length:undefined})),stateError,coverage:selected.coverage,totals:selected.totals,combined:selected.combined,unallocated:selected.unallocated,rejectedCountyReports:selected.rejectedCountyReports};
await fs.writeFile(`${directory}/summary.json`,JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,`## Production turnout verification\n\nVersion: ${RECONCILIATION_VERSION}\n\nPublic version marker: verified. Method/party reconciliation: passed.\n\n\`\`\`json\n${JSON.stringify(summary,null,2)}\n\`\`\`\n`);
assert.ok(batches.every(b=>b.status==='fulfilled'),'Some production batches were unreadable; see the recorded limitations.');
assert.ok(state,'State benchmark was not readable; see the recorded limitation.');
