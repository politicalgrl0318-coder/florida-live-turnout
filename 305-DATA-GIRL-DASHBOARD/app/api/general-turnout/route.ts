import {NextRequest,NextResponse} from 'next/server';
import {COUNTY_NAMES as counties,makeCountyRow,mergeCountyRows,type TurnoutRow} from '../../general/method-selection';
import {countySeed} from '../../general/county-seed';
import {fetchBrowardCounty,tqvCountyRow} from '../../general/official-methods';
export const runtime='edge';
export const dynamic='force-dynamic';
const base='https://s3.us-east-1.amazonaws.com/turnoutquickview.electionsfl.org/data/FL';
const source=(code:string)=>`https://tqv.vrswebapps.com/?state=FL&county=${code.toLowerCase()}`;
const browardPrecinctCsv='https://updates.electionlink.net/widgets/browardfl/2026-11-03/TurnoutByPrecinctTable.csv';
const cache=new Map<string,{expires:number;promise:Promise<any>}>();
const retained=new Map<string,TurnoutRow>(countySeed().map(r=>[r.code,r]));
async function generalElectionData(code:string){
 const cached=cache.get(code),now=Date.now();if(cached&&cached.expires>now)return cached.promise;
 const options={cf:{cacheTtl:60,cacheEverything:true},signal:AbortSignal.timeout(12000)} as RequestInit;
 const promise=(async()=>{
  const index=await fetch(`${base}/${code}/index.json`,options);if(!index.ok)throw new Error('County index retrieval failed');
  const elections=await index.json() as (string|number)[];
  if(!Array.isArray(elections))throw new Error('Invalid county election index');
  for(const election of [...elections].sort((a,b)=>Number(b)-Number(a))){
   const r=await fetch(`${base}/${code}/${election}/data.json`,options);if(!r.ok)continue;
   const data=await r.json() as any,s=data?.Summary;
   if(/general/i.test(String(s?.ElectionName))&&/^11\/0?3\/2026$/.test(String(s?.ElectionDate))&&String(s?.FvrsElectionNumber)==='49894')return data;
  }
  throw new Error('Election 49894 could not be verified in the retrieved county index');
 })();
 cache.set(code,{expires:now+60000,promise});try{return await promise;}catch(e){cache.delete(code);throw e;}
}
function precinctActivity(data:any){
 type Row={precinct:string;location:string;address:string;eligible:number;mail:number;early:number;electionDay:number;ballots:number;turnout:number};
 const totals=data?.Turnout?.PrecinctType||{},splits=data?.PrecinctSplit||{},locations=data?.Location?.ElectionDay||{},aggregated=new Map<string,Row>();
 for(const [key,value] of Object.entries(totals) as [string,any][]){
  const baseKey=key.split('.')[0],meta=splits[key]||splits[baseKey]||{},precinct=String(meta.Precinct||baseKey||key),location=locations[String(meta.Location||'')]||{},types=value?.BallotTypeTotals||{};
  const mail=Number(types.Mail||0),early=Number(types.EarlyVoting||0),electionDay=Number(types.ElectionDay||0),eligible=Number(value?.EligibleVoters||0);
  const row=aggregated.get(precinct)||{precinct,location:String(location.Name||''),address:String(location.Address||''),eligible:0,mail:0,early:0,electionDay:0,ballots:0,turnout:0};
  row.eligible+=eligible;row.mail+=mail;row.early+=early;row.electionDay+=electionDay;row.ballots+=mail+early+electionDay;
  if(!row.location&&location.Name)row.location=String(location.Name);if(!row.address&&location.Address)row.address=String(location.Address);aggregated.set(precinct,row);
 }
 return [...aggregated.values()].map(r=>({...r,turnout:r.eligible?r.ballots/r.eligible*100:0})).filter(r=>r.ballots>0).sort((a,b)=>b.ballots-a.ballots||a.precinct.localeCompare(b.precinct,undefined,{numeric:true}));
}
function csvRows(csv:string){return csv.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean).map(line=>{const cells:string[]=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&quoted&&line[i+1]==='"'){value+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===','&&!quoted){cells.push(value.trim());value='';}else value+=c;}cells.push(value.trim());return cells;});}
function browardUpdated(csv:string){return csvRows(csv)[0]?.join(',').match(/AS OF\s+(.+)$/i)?.[1]||null;}
function browardPrecinctRows(csv:string){const rows=csvRows(csv),header=rows.findIndex(r=>r[0]?.toLowerCase()==='precinct');if(header<0)return [];return rows.slice(header+1).map(r=>{const value=(i:number)=>Number((r[i]||'').replaceAll(',',''))||0,eligible=value(1),mail=value(2),early=value(3),electionDay=value(4),ballots=mail+early+electionDay;return {precinct:r[0]||'',location:'',address:'',eligible,mail,early,electionDay,ballots,turnout:eligible?ballots/eligible*100:0};}).filter(r=>r.precinct&&r.ballots>0).sort((a,b)=>b.ballots-a.ballots||a.precinct.localeCompare(b.precinct,undefined,{numeric:true}));}
async function browardCsv(){const r=await fetch(browardPrecinctCsv,{cache:'no-store',signal:AbortSignal.timeout(12000),headers:{Accept:'text/csv,text/plain;q=0.9,*/*;q=0.8'}});if(!r.ok)throw new Error('Broward precinct CSV could not be retrieved');const csv=await r.text();if(!/GENERAL ELECTION/i.test(csv))throw new Error('Broward CSV election could not be verified');return csv;}
export async function GET(request:NextRequest){
 const view=request.nextUrl.searchParams.get('view');
 if(view==='locations'){
  const code=String(request.nextUrl.searchParams.get('county')||'').toUpperCase();if(!counties[code])return NextResponse.json({error:'Choose a valid county.'},{status:400});
  try{
   const data=await generalElectionData(code),byLocation=data?.Turnout?.LocationParty?.EarlyVoting,metadata=data?.Location?.EarlyVoting;if(!byLocation||!metadata)throw new Error('Location data missing');
   const locations=Object.entries(byLocation).map(([id,raw])=>{const split={dem:0,rep:0,npa:0,other:0,unallocated:0};for(const [party,value] of Object.entries(raw as Record<string,number>)){if(!Number.isSafeInteger(value)||value<0)throw new Error('Invalid party count');const key=party==='DEM'?'dem':party==='REP'?'rep':party==='NPA'?'npa':['','UNK','UNKNOWN','UNALLOCATED'].includes(party.toUpperCase())?'unallocated':'other';split[key]+=value;}if(!metadata[id]?.Name)throw new Error('Missing location name');return {id,name:String(metadata[id].Name),address:String(metadata[id].Address||''),...split,total:Object.values(split).reduce((a,b)=>a+b,0)};}).sort((a,b)=>a.name.localeCompare(b.name));
   const total=Object.values(data.Turnout.PartyType||{}).reduce((n:number,r:any)=>n+Number(r.EarlyVoting||0),0);if(!locations.length||locations.reduce((n,r)=>n+r.total,0)!==total)throw new Error('Location totals do not reconcile');
   return NextResponse.json({county:{code,name:counties[code]},updated:data.Summary.LastUpdatedTime,sourceUrl:source(code),locations},{headers:{'Cache-Control':'public, max-age=30, s-maxage=60'}});
  }catch{return NextResponse.json({error:`A reconciled early-voting location-by-party report for ${counties[code]} could not be retrieved. This does not establish that its official feed is inactive.`},{status:404,headers:{'Cache-Control':'no-store'}});}
 }
 if(view==='precincts'){
  const code=String(request.nextUrl.searchParams.get('county')||'').toUpperCase(),name=counties[code];if(!name)return NextResponse.json({error:'Choose a valid Florida county.'},{status:400,headers:{'Cache-Control':'no-store'}});
  try{
   if(code==='BRO'){const csv=await browardCsv(),precincts=browardPrecinctRows(csv);if(!precincts.length)throw new Error('No usable precinct rows');return NextResponse.json({county:{code,name},updated:browardUpdated(csv),precincts},{headers:{'Cache-Control':'public, max-age=60, s-maxage=120'}});}
   const data=await generalElectionData(code),precincts=precinctActivity(data);if(!precincts.length)throw new Error('No usable precinct rows');return NextResponse.json({county:{code,name},updated:data.Summary?.LastUpdatedTime||null,precincts},{headers:{'Cache-Control':'public, max-age=60, s-maxage=120'}});
  }catch{return NextResponse.json({error:`A usable official precinct report for ${name} could not be retrieved. No zero turnout is inferred.`},{status:404,headers:{'Cache-Control':'no-store'}});}
 }
 const batch=Number(request.nextUrl.searchParams.get('batch')||0);if(!Number.isInteger(batch)||batch<0||batch>4)return NextResponse.json({error:'County batch must be 0 through 4.'},{status:400});
 const entries=Object.entries(counties).slice(batch*15,(batch+1)*15);
 const incoming=await Promise.all(entries.map(async([code,name])=>{try{return code==='BRO'?await fetchBrowardCounty():tqvCountyRow(code,name,await generalElectionData(code));}catch(e){return makeCountyRow(code,name,{}, {warnings:[`Latest county retrieval: ${e instanceof Error?e.message:String(e)}. Missing is not zero.`],fetchedAt:new Date().toISOString()});}}));
 const rows=mergeCountyRows(entries.flatMap(([code])=>retained.has(code)?[retained.get(code)!]:[]),incoming,Date.now());
 rows.forEach(r=>retained.set(r.code,r));
 return NextResponse.json({generatedAt:new Date().toISOString(),electionNumber:'49894',electionName:'2026 General Election',electionDate:'11/03/2026',counties:rows},{headers:{'Cache-Control':'no-store'}});
}
