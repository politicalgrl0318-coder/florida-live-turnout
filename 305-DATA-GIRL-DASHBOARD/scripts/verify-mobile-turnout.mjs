import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const origin=process.env.BASE_URL||'https://florida-live-turnout.politicalgrl0318.workers.dev';
const output='verification/mobile-turnout';await mkdir(output,{recursive:true});
let ready=false;
for(let i=0;i<24;i++){try{const r=await fetch(`${origin}/general?layoutCheck=${Date.now()}`,{signal:AbortSignal.timeout(15000)});const html=await r.text();if(r.ok&&html.includes('data-layout-version="mobile-v3"')){ready=true;await writeFile(`${output}/production.html`,html);break;}}catch{}await new Promise(r=>setTimeout(r,5000));}
assert.ok(ready,'The expected layout is not deployed at the tested origin.');
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,acceptDownloads:true});
const page=await context.newPage(),errors=[],batches=new Map(),responseWrites=[];let state=null;
page.on('pageerror',e=>errors.push(String(e)));
page.on('response',response=>{const url=new URL(response.url());if(url.pathname==='/api/general-turnout'&&url.searchParams.has('batch'))responseWrites.push((async()=>{try{const data=await response.json(),batch=url.searchParams.get('batch');batches.set(batch,data);await writeFile(`${output}/batch-${batch}.json`,JSON.stringify(data,null,2));}catch{}})());if(url.pathname==='/api/general')responseWrites.push((async()=>{try{state=await response.json();await writeFile(`${output}/state.json`,JSON.stringify(state,null,2));}catch{}})());});
const findings={origin,startedAt:new Date().toISOString(),widths:[],errors};
try{
 await page.goto(`${origin}/general?mobileVerify=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForSelector('main[data-selection-ready="true"]',{timeout:65000});
 await Promise.all(responseWrites);
 assert.equal(batches.size,5,'All five county batches must actually be retrieved');
 const inventory=[...batches.values()].flatMap(b=>b.counties||[]);assert.equal(inventory.length,67);assert.equal(new Set(inventory.map(r=>r.code)).size,67);
 assert.ok([...batches.values()].every(b=>String(b.electionNumber)==='49894'),'Wrong or missing election identity');
 const broward=inventory.find(r=>r.code==='BRO');assert.ok(broward?.methodReports?.early,'Broward early method missing');assert.match(broward.methodReports.early.sourceUrl,/TurnOutWidget/);assert.equal(!!broward.methodReports.early.retained,false,`Broward live combined feed was not successfully imported: ${JSON.stringify(broward.warnings)}`);
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download totals & source details'}).click();const download=await downloadPromise;await download.saveAs(`${output}/selected.json`);const selected=JSON.parse(await readFile(`${output}/selected.json`,'utf8'));
 const cards=await page.locator('[data-live-summary]>article').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.getAttribute('data-method'),Number(n.getAttribute('data-total'))])));
 assert.equal(await page.locator('[data-live-summary]').count(),1,'Duplicate live summaries');
 assert.equal(cards.combined,selected.combined.total);for(const method of ['mail','early','electionDay'])assert.equal(cards[method],selected.totals[method].total);
 assert.equal(cards.combined,cards.mail+cards.early+cards.electionDay);
 assert.equal(selected.rows.reduce((sum,r)=>sum+r.ballots,0),cards.combined);
 assert.equal(selected.combined.dem+selected.combined.rep+selected.combined.npa+selected.combined.other+selected.unallocated,cards.combined);
 assert.equal(Number(await page.locator('[data-reconciled-total]').getAttribute('data-reconciled-total')),cards.combined);
 assert.ok(selected.reconciled);assert.equal(selected.rows.find(r=>r.code==='BRO').methods.early.source,'county');
 assert.equal(await page.locator('[data-historical-snapshot]').getAttribute('open'),null,'Historical snapshot must start collapsed');
 for(const width of [375,390,430]){
  await page.setViewportSize({width,height:844});
  await page.waitForTimeout(150);
  const overflow=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(overflow.document<=overflow.viewport+1,`Horizontal page overflow at ${width}px: ${JSON.stringify(overflow)}`);
  assert.equal(await page.locator('[data-county-desktop]').isVisible(),false);assert.equal(await page.locator('[data-county-mobile]').isVisible(),true);
  const positions=await page.locator('[data-live-summary] [data-count-share]').evaluateAll(nodes=>nodes.map(n=>{const value=n.querySelector('[data-value]').getBoundingClientRect(),share=n.querySelector('[data-share]').getBoundingClientRect();return {bottom:value.bottom,top:share.top,value:n.querySelector('[data-value]').textContent,share:n.querySelector('[data-share]').textContent};}));
  assert.ok(positions.length>=12);assert.ok(positions.every(p=>p.top>=p.bottom+3),'A share overlaps or touches its raw count');
  const dayHeight=await page.locator('[data-live-summary]>[data-method="electionDay"]').evaluate(n=>n.getBoundingClientRect().height);assert.ok(dayHeight<220,'Election Day card still has excessive empty height');
  findings.widths.push({width,noHorizontalOverflow:true,countyCardsVisible:true,countShareSeparation:true,electionDayHeight:dayHeight});
 }
 await page.setViewportSize({width:390,height:844});await page.locator('[data-live-summary]').screenshot({path:`${output}/live-mobile.png`});
 await page.getByRole('textbox',{name:'Search county reports'}).fill('Broward');assert.equal(await page.locator('[data-county-mobile]>article').count(),1);
 await page.locator('[data-county-mobile] summary').click();await page.locator('[data-county-mobile]').screenshot({path:`${output}/county-mobile.png`});
 await page.getByRole('textbox',{name:'Search county reports'}).fill('');
 await page.locator('[data-historical-snapshot]>summary').click();await page.locator('[data-historical-snapshot]').screenshot({path:`${output}/archive-mobile.png`});
 const archived=await page.locator('[data-historical-snapshot] [data-count-share]').evaluateAll(nodes=>nodes.map(n=>({v:n.querySelector('[data-value]').getBoundingClientRect().bottom,p:n.querySelector('[data-share]').getBoundingClientRect().top})));assert.ok(archived.every(p=>p.p>=p.v+3),'Historical shares touch their raw count');
 await page.locator('[data-historical-snapshot]>summary').click();
 await page.setViewportSize({width:1440,height:1000});assert.equal(await page.locator('[data-county-desktop]').isVisible(),true);assert.equal(await page.locator('[data-county-mobile]').isVisible(),false);await page.locator('[data-live-summary]').screenshot({path:`${output}/live-desktop.png`});
 assert.equal(errors.length,0,'Browser JavaScript errors');
 Object.assign(findings,{status:'verified',finishedAt:new Date().toISOString(),batches:5,counties:67,oneLiveSummary:true,headlineCountyExportReconciliation:true,browardLiveEarlySource:broward.methodReports.early,combined:selected.combined,methods:selected.totals,coverage:selected.coverage,sourceTimestamps:selected.sourceTimestamps,snapshotCheckedAt:selected.checkedAt,desktopTableVisible:true,historicalSnapshotCollapsed:true});
 await writeFile(`${output}/summary.json`,JSON.stringify(findings,null,2));
 await writeFile(`${output}/visible-page.txt`,await page.locator('main').innerText());
 console.log(JSON.stringify(findings,null,2));
 if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,`## Mobile turnout verification\n\nOrigin: ${origin}\n\nAll five batches, 67 counties, live Broward early-voting source and headline/county/export reconciliation verified.\n\nPhone widths: 375, 390, 430. Count/share separation and absence of horizontal overflow verified. Desktop table verified at 1440.\n\n\`\`\`json\n${JSON.stringify(findings,null,2)}\n\`\`\`\n`,{flag:'a'});
}catch(error){findings.status='failed';findings.failure=String(error);await writeFile(`${output}/summary.json`,JSON.stringify(findings,null,2));await page.screenshot({path:`${output}/failure.png`,fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();}
