import {isCurrentGeneral,makeCountyRow,sourceStamp,validMethod,zeroParties,METHODS,PARTIES,type CountyMethod,type Method,type TurnoutRow} from './method-selection';
const browardBase='https://my.browardvotes.gov/TEDElectionLink';
export const BROWARD_URLS={mail:`${browardBase}/AbsenteeTurnOut/dashboard/view/absturnout-party`,party:`${browardBase}/TurnOutWidget/dashboard/view/turnout-party`,summary:`${browardBase}/TurnOutWidget/dashboard/view/turnout-summary`};
const methodKeys:Record<Method,string>={mail:'Mail',early:'EarlyVoting',electionDay:'ElectionDay'};
function count(value:unknown){if(!Number.isSafeInteger(value)||Number(value)<0)throw new Error('Invalid nonnegative integer count');return Number(value);}
function partyKey(label:string):'dem'|'rep'|'npa'|'other'|'unallocated'{const s=label.trim().toUpperCase();if(['','UNK','UNKNOWN','UNALLOCATED','UNASSIGNED'].includes(s))return 'unallocated';if(s==='DEM'||s==='FLORIDA DEMOCRATIC PARTY')return 'dem';if(s==='REP'||s==='REPUBLICAN PARTY OF FLORIDA')return 'rep';if(s==='NPA'||s==='NO PARTY AFFILIATION')return 'npa';return 'other';}
export function tqvCountyRow(code:string,name:string,data:any,fetchedAt=new Date().toISOString()):TurnoutRow{
 const summary=data?.Summary;
 if(!isCurrentGeneral(summary?.ElectionName,summary?.ElectionDate)||String(summary?.FvrsElectionNumber)!=='49894')throw new Error('Wrong or unidentified election');
 const p=data?.Turnout?.PartyType,dates=data?.Turnout?.DateType;
 if(!p||typeof p!=='object'||!dates||typeof dates!=='object')throw new Error('Missing county method data');
 const methodReports:Partial<Record<Method,CountyMethod|null>>={},warnings:string[]=[];
 for(const method of METHODS){
  const key=methodKeys[method];
  try{
   const rows=Object.values(dates) as Record<string,number>[];
   if(!rows.some(r=>Object.hasOwn(r,key))&&!Object.values(p).some((r:any)=>Object.hasOwn(r,key))){methodReports[method]=null;continue;}
   const parties=zeroParties();let unallocated=0;
   for(const [label,values] of Object.entries(p) as [string,Record<string,number>][]){const value=count(values[key]??0),group=partyKey(label);if(group==='unallocated')unallocated+=value;else parties[group]+=value;}
   const total=rows.reduce((sum,r)=>sum+count(r[key]??0),0);
   const report:CountyMethod={total,parties,unallocated,reported:summary.LastUpdatedTime||null,sourceUrl:`https://tqv.vrswebapps.com/?state=FL&county=${code.toLowerCase()}`};
   if(!validMethod(report))throw new Error('date totals and party totals disagree');
   methodReports[method]=report;
  }catch(e){methodReports[method]=null;warnings.push(`${method}: ${e instanceof Error?e.message:'unreconciled report'}; method withheld, not treated as zero.`);}
 }
 const registered=Number(summary.ActiveEligibleVoters||summary.TotalRegisteredVoters||0);
 return makeCountyRow(code,name,methodReports,{registered:Number.isSafeInteger(registered)&&registered>=0?registered:0,warnings,fetchedAt});
}
function text(html:string){return html.replace(/<!--[\s\S]*?-->/g,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();}
function election(html:string){if(!/11\/0?3\/2026\s*-\s*2026\s+(?:November\s+)?General Election/i.test(text(html)))throw new Error('Broward election identity not verified');}
function stamp(html:string){const values=[...html.matchAll(/data-ted-dashboard-asof-src=["']([^"']+)["']/gi)].map(m=>m[1]);if(!values.length||new Set(values).size!==1||!sourceStamp(values[0])?.explicitZone)throw new Error('Broward source timestamp missing or inconsistent');return values[0];}
function charts(html:string){return [...html.matchAll(/<script\b[^>]*class=["'][^"']*ted-ec-initial[^"']*["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap(m=>{try{return [JSON.parse(m[1]).option];}catch{return [];}});}
function numberCell(value:string){if(!/^\d[\d,]*$/.test(value))throw new Error('Unrecognized numeric table cell');return count(Number(value.replaceAll(',','')));}
export function parseBrowardCombined(partyHtml:string,summaryHtml:string):Partial<Record<Method,CountyMethod>>{
 election(partyHtml);election(summaryHtml);const reported=stamp(partyHtml);if(reported!==stamp(summaryHtml))throw new Error('Broward party and summary timestamps differ');
 const tables=[...partyHtml.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)];
 let rows:string[][]|null=null;
 for(const table of tables){const candidate=[...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(r=>[...r[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>text(c[1])));if(candidate.some(r=>['Party','Vote By Mail','Early Vote','Election Day','Total'].every(h=>r.includes(h)))){rows=candidate;break;}}
 if(!rows)throw new Error('Combined party-by-method table not found');
 const header=rows.find(r=>r.includes('Vote By Mail')&&r.includes('Early Vote'))!,index=(name:string)=>header.indexOf(name);
 const results:Record<Method,CountyMethod>={mail:{total:0,parties:zeroParties(),unallocated:0,reported,sourceUrl:BROWARD_URLS.party},early:{total:0,parties:zeroParties(),unallocated:0,reported,sourceUrl:BROWARD_URLS.party},electionDay:{total:0,parties:zeroParties(),unallocated:0,reported,sourceUrl:BROWARD_URLS.party}};
 const labels=new Set<string>();
 for(const row of rows){const label=row[index('Party')];if(!label||label==='Party')continue;const normalized=label.trim().toUpperCase();if(!['FLORIDA DEMOCRATIC PARTY','REPUBLICAN PARTY OF FLORIDA','NO PARTY AFFILIATION','OTHER','UNKNOWN','UNALLOCATED','UNK'].includes(normalized))throw new Error('Unrecognized Broward party row');const group=partyKey(label);if(labels.has(group))throw new Error('Duplicate Broward party group');labels.add(group);
  const counts={mail:numberCell(row[index('Vote By Mail')]),early:numberCell(row[index('Early Vote')]),electionDay:numberCell(row[index('Election Day')])};
  if(counts.mail+counts.early+counts.electionDay!==numberCell(row[index('Total')]))throw new Error('Broward party row total does not reconcile');
  for(const method of METHODS){results[method].total+=counts[method];if(group==='unallocated')results[method].unallocated+=counts[method];else results[method].parties[group]+=counts[method];}
 }
 if(PARTIES.some(p=>!labels.has(p)))throw new Error('Broward party table is partial');
 const pie=charts(summaryHtml).flatMap(o=>o?.series||[]).find(s=>s.type==='pie'&&Array.isArray(s.data)&&s.data.some((r:any)=>r.name==='Early Vote'));
 if(!pie)throw new Error('Broward summary method totals not found');
 for(const [method,label] of [['mail','Vote By Mail'],['early','Early Vote'],['electionDay','Election Day']] as [Method,string][]){const matching=pie.data.filter((r:any)=>r.name===label);if(matching.length!==1||count(matching[0].value)!==results[method].total||!validMethod(results[method]))throw new Error(`Broward ${method} summary/party reconciliation failed`);}
 // Provisional is deliberately not read into any selected voting method.
 return results;
}
export function parseBrowardMail(html:string):CountyMethod{
 election(html);const reported=stamp(html),option=charts(html).find(o=>Array.isArray(o?.yAxis?.data)&&o?.series?.some((s:any)=>s.name==='Returned'));
 if(!option)throw new Error('Broward returned-mail chart unavailable');
 const labels=option.yAxis.data as string[],values=option.series.find((s:any)=>s.name==='Returned').data as unknown[];
 if(labels.length!==values.length)throw new Error('Broward mail chart schema mismatch');
 const parties=zeroParties();let unallocated=0;const groups=new Set<string>();
 labels.forEach((label,i)=>{const group=partyKey(label);if(groups.has(group))throw new Error('Duplicate mail party group');groups.add(group);const value=count(values[i]);if(group==='unallocated')unallocated+=value;else parties[group]+=value;});
 if(PARTIES.some(p=>!groups.has(p)))throw new Error('Broward mail report is partial');
 const totalMatch=text(html).match(/Total Returned\s+([\d,]+)/i);if(!totalMatch)throw new Error('Broward mail total not found');
 const report={total:numberCell(totalMatch[1]),parties,unallocated,reported,sourceUrl:BROWARD_URLS.mail};if(!validMethod(report))throw new Error('Broward mail party counts do not match returned total');return report;
}
async function getHtml(url:string){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000),headers:{Accept:'text/html,application/xhtml+xml'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text();}
export async function fetchBrowardCounty():Promise<TurnoutRow>{
 const requests=await Promise.allSettled([getHtml(BROWARD_URLS.mail),getHtml(BROWARD_URLS.party),getHtml(BROWARD_URLS.summary)]),methods:Partial<Record<Method,CountyMethod|null>>={},warnings:string[]=[];
 try{if(requests[1].status!=='fulfilled'||requests[2].status!=='fulfilled')throw new Error('Combined county report retrieval unavailable');Object.assign(methods,parseBrowardCombined(requests[1].value,requests[2].value));}catch(e){warnings.push(`Broward combined report: ${e instanceof Error?e.message:String(e)}. Earlier verified methods or dated state fallbacks may be retained.`);}
 try{if(requests[0].status!=='fulfilled')throw new Error('Mail county report retrieval unavailable');const mail=parseBrowardMail(requests[0].value);if(!methods.mail||sourceStamp(mail.reported)!.min>=sourceStamp(methods.mail.reported)!.min)methods.mail=mail;}catch(e){warnings.push(`Broward mail report: ${e instanceof Error?e.message:String(e)}.`);}
 return makeCountyRow('BRO','Broward',methods,{warnings,fetchedAt:new Date().toISOString()});
}
