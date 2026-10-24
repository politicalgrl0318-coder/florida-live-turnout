import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';

const origin='https://florida-live-turnout.politicalgrl0318.workers.dev';
const expected=JSON.parse(await readFile(new URL('../public/data/general-verified-update.json',import.meta.url),'utf8'));
const output=new URL('../verification/live-turnout/',import.meta.url);
await mkdir(output,{recursive:true});
const fields=['total','dem','rep','npa','other','unallocated'];
const methods=['mail','early','electionDay'];
let error;
for(let attempt=0;attempt<16;attempt++){
 try{
  const nonce=Date.now();
  const [pageResponse,dataResponse]=await Promise.all([
   fetch(`${origin}/general?verifyPublished=${nonce}`,{cache:'no-store',signal:AbortSignal.timeout(20000)}),
   fetch(`${origin}/data/general-verified-update.json?verifyPublished=${nonce}`,{cache:'no-store',signal:AbortSignal.timeout(20000)})
  ]);
  assert.equal(pageResponse.status,200,'Main dashboard must respond HTTP 200');
  assert.equal(dataResponse.status,200,'Published snapshot must respond HTTP 200');
  const page=await pageResponse.text(),actual=await dataResponse.json();
  assert.equal(actual.electionNumber,'49894');
  assert.equal(actual.checkedAt,expected.checkedAt,'Deployed snapshot version');
  assert.deepEqual(actual.combined,expected.combined);
  assert.deepEqual(actual.methods,expected.methods);
  assert.deepEqual(actual.coverage,expected.coverage);
  for(const row of [...methods.map(m=>actual.methods[m]),actual.combined]){
   for(const field of fields)assert.ok(Number.isSafeInteger(row[field])&&row[field]>=0,`Invalid ${field}`);
   assert.equal(row.total,row.dem+row.rep+row.npa+row.other+row.unallocated,'Party reconciliation');
  }
  for(const field of fields)assert.equal(actual.combined[field],methods.reduce((sum,m)=>sum+actual.methods[m][field],0),`Method reconciliation: ${field}`);
  assert.ok(page.includes(`data-verified-update="${expected.checkedAt}"`),'Verified update marker absent from production HTML');
  assert.ok(page.includes('Verified statewide update'),'Verified section heading absent');
  for(const total of [actual.combined.total,actual.methods.mail.total,actual.methods.early.total])assert.ok(page.includes(new Intl.NumberFormat('en-US').format(total)),`Visible count ${total} absent from production HTML`);
  assert.ok(page.includes('/data/general-verified-update.json'),'Snapshot source link absent');
  const result={status:'verified',verifiedAt:new Date().toISOString(),url:`${origin}/general`,snapshotCheckedAt:actual.checkedAt,combined:actual.combined,methods:actual.methods,coverage:actual.coverage,serverRendered:true,commit:process.env.GITHUB_SHA||null};
  await writeFile(new URL('published-update-verification.json',output),JSON.stringify(result,null,2));
  await writeFile(new URL('published-update.json',output),JSON.stringify(actual,null,2));
  await writeFile(new URL('published-update-page.html',output),page);
  console.log(JSON.stringify(result,null,2));
  process.exit(0);
 }catch(e){error=e;console.log(`Published update check ${attempt+1}: ${e.message}`);if(attempt<15)await new Promise(resolve=>setTimeout(resolve,10000));}
}
await writeFile(new URL('published-update-verification.json',output),JSON.stringify({status:'not verified',checkedAt:new Date().toISOString(),error:String(error)},null,2));
throw error;
