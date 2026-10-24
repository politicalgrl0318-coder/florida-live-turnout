import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./resolve-ts.mjs',import.meta.url);
const {reconcileTurnout,RECONCILIATION_VERSION,COUNTY_NAMES,isCurrentGeneral}=await import('../app/general/method-selection.ts');
const origin='https://florida-live-turnout.politicalgrl0318.workers.dev';
const directory='verification/live-turnout';await fs.mkdir(directory,{recursive:true});
let html='',deployed=false;
for(let attempt=0;attempt<18;attempt++){
 try{const response=await fetch(`${origin}/general?verify=${RECONCILIATION_VERSION}-${Date.now()}`,{signal:AbortSignal.timeout(20000),cache:'no-store'});html=await response.text();if(response.ok&&html.includes(`data-reconciliation-version="${RECONCILIATION_VERSION}"`)){deployed=true;break;}}catch(error){console.log('Deployment read:',String(error));}
 await new Promise(resolve=>setTimeout(resolve,10000));
}
assert.ok(deployed,'Expected reconciliation version not verified on production.');await fs.writeFile(`${directory}/production.html`,html);
const checkedAt=new Date().toISOString(),stamp=Date.now();
const batches=await Promise.allSettled(Array.from({length:5},async(_,batch)=>{const response=await fetch(`${origin}/api/general-turnout?batch=${batch}&t=${stamp}`,{signal:AbortSignal.timeout(45000),cache:'no-store'});assert.ok(response.ok,`Batch ${batch}: HTTP ${response.status}`);const payload=await response.json();assert.ok(isCurrentGeneral(payload.electionName,payload.electionDate),`Batch ${batch}: wrong election`);assert.equal(String(payload.electionNumber),'49894');assert.ok(Array.isArray(payload.counties));await fs.writeFile(`${directory}/batch-${batch}.json`,JSON.stringify(payload,null,2));return payload;}));
let state=null,stateError='';
try{const response=await fetch(`${origin}/api/general?t=${stamp}`,{signal:AbortSignal.timeout(20000),cache:'no-store'});assert.ok(response.ok);state=await response.json();assert.equal(String(state.electionNumber),'49894');await fs.writeFile(`${directory}/state.json`,JSON.stringify(state,null,2));}catch(error){stateError=String(error);}
const rows=batches.flatMap(b=>b.status==='fulfilled'?b.value.counties:[]),selected=reconcileTurnout(rows,state,Date.now());
assert.ok(selected.reconciled,'Party/method reconciliation failed');assert.equal(selected.coverage.inventory,Object.keys(COUNTY_NAMES).length);
await fs.writeFile(`${directory}/selected.json`,JSON.stringify(selected,null,2));
const summary={productionVersion:RECONCILIATION_VERSION,productionMarkerVerified:deployed,checkedAt,finishedAt:new Date().toISOString(),batches:batches.map((b,i)=>({batch:i,status:b.status,error:b.status==='rejected'?String(b.reason):undefined,counties:b.status==='fulfilled'?b.value.counties.length:undefined})),stateError,coverage:selected.coverage,totals:selected.totals,combined:selected.combined,unallocated:selected.unallocated,sourceTimestamps:selected.sourceTimestamps,rejectedCountyReports:selected.rejectedCountyReports};
await fs.writeFile(`${directory}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,`## Production turnout verification\n\nVersion ${RECONCILIATION_VERSION}; deployed marker verified.\n\n\`\`\`json\n${JSON.stringify(summary,null,2)}\n\`\`\`\n`);
assert.ok(batches.every(b=>b.status==='fulfilled'),'Some production batches unreadable; see evidence.');assert.equal(rows.length,67);assert.equal(new Set(rows.map(r=>r.code)).size,67);assert.ok(state,'State benchmark unreadable; see evidence.');
