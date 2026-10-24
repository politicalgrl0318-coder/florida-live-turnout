import {COUNTY_NAMES,FRESHNESS_MINUTES,METHODS,PARTIES,isCurrentGeneral,partySum,sourceStamp,validSplit,zeroParties,usableCounty as usableLegacy,type PartySplit,type StateSplit,type StateReport,type Method,type Stamp,type TurnoutRow as LegacyRow} from './county-reports';
export {COUNTY_NAMES,FRESHNESS_MINUTES,METHODS,PARTIES,isCurrentGeneral,partySum,sourceStamp,validSplit,zeroParties};
export type {PartySplit,StateSplit,StateReport,Method,Stamp};
export const RECONCILIATION_VERSION='2026-10-24-method-v3-mobile';
export type CountyMethod={total:number;parties:PartySplit;unallocated:number;reported:string|null;sourceUrl:string;retained?:boolean;note?:string};
export type TurnoutRow=LegacyRow&{methodReports?:Partial<Record<Method,CountyMethod|null>>;warnings?:string[];fetchedAt?:string;unallocated?:number};
export type MethodReport=CountyMethod&{method:Method;source:'county'|'state';reported:string;activityThrough:string;stamp:Stamp|null;freshness:string;retained:boolean;note:string};
export type SelectedCounty={code:string;name:string;methods:Record<Method,MethodReport|null>;ballots:number;parties:PartySplit;unallocated:number;missing:Method[];warnings:string[]};
export type MethodTotal=PartySplit&{total:number;unallocated:number;reportedCounties:number;recentCounties:number;fallbackCounties:number;missingCounties:number};
const activeDate='2026-11-03';
const stateUrl='https://countyfilesvbm-ev.floridados.gov/VoteByMailEarlyVotingReports/PublicStats';
const day=(ms:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
const previousDay=(s:string)=>new Date(Date.parse(s+'T12:00:00Z')-86400000).toISOString().slice(0,10);
export function validMethod(r:CountyMethod|null|undefined):r is CountyMethod{return !!r&&Number.isSafeInteger(r.total)&&r.total>=0&&Number.isSafeInteger(r.unallocated)&&r.unallocated>=0&&!!r.parties&&PARTIES.every(p=>Number.isSafeInteger(r.parties[p])&&r.parties[p]>=0)&&partySum(r.parties)+r.unallocated===r.total&&/^https:\/\//.test(r.sourceUrl);}
function compatible(r:TurnoutRow){return !!r&&!!COUNTY_NAMES[r.code]&&r.status==='live'&&isCurrentGeneral(r.electionName,r.electionDate);}
function reports(r:TurnoutRow):Partial<Record<Method,CountyMethod|null>>{
 if(!compatible(r))return {};
 if(r.methodReports!==undefined)return r.methodReports;
 if(!usableLegacy(r))return {};
 return Object.fromEntries(METHODS.map(m=>[m,/\/AbsenteeTurnOut\//i.test(r.sourceUrl)&&m!=='mail'?null:{total:r[m],parties:r[`${m}Party`],unallocated:0,reported:r.updated,sourceUrl:r.sourceUrl,retained:!!r.retained,note:''}])) as Partial<Record<Method,CountyMethod|null>>;
}
export function usableCounty(r:TurnoutRow){return !!r&&!!COUNTY_NAMES[r.code]&&(r.status==='unavailable'||compatible(r)&&(r.methodReports!==undefined?METHODS.some(m=>validMethod(r.methodReports?.[m])):usableLegacy(r)));}
function stampOrder(a:Stamp|null,b:Stamp|null){if(a&&!b)return 1;if(!a&&b)return -1;if(!a||!b)return 0;if(a.min>b.max)return 1;if(a.max<b.min)return -1;return a.explicitZone===b.explicitZone?Math.sign(a.min-b.min):0;}
function acceptableTime(r:CountyMethod,now:number,fetchedAt?:string){const s=sourceStamp(r.reported),f=fetchedAt?Date.parse(fetchedAt):NaN;const limit=Number.isFinite(f)?Math.min(now,f):now;return !s||s.min<=limit+60000;}
function freshness(r:CountyMethod,now:number){if(r.retained)return 'retained';const s=sourceStamp(r.reported);if(!s||s.min>now+60000)return 'unknown';return now-s.min<=FRESHNESS_MINUTES*60000&&s.max<=now+60000?'recent':'delayed';}
export function countyFreshness(row:TurnoutRow,now=Date.now()){const used=Object.values(reports(row)).filter(validMethod);if(!used.length)return 'unavailable';if(used.some(r=>r.retained))return 'retained';return used.every(r=>freshness(r,now)==='recent')?'recent':'delayed';}
export function makeCountyRow(code:string,name:string,methodReports:Partial<Record<Method,CountyMethod|null>>,extras:Partial<TurnoutRow>={}):TurnoutRow{
 const list=METHODS.flatMap(m=>validMethod(methodReports[m])?[methodReports[m]!]:[]);
 const split=zeroParties();for(const r of list)for(const p of PARTIES)split[p]+=r.parties[p];
 const total=list.reduce((s,r)=>s+r.total,0),registered=extras.registered||0;
 const latest=[...list].sort((a,b)=>(sourceStamp(b.reported)?.min||0)-(sourceStamp(a.reported)?.min||0))[0];
 return {...extras,code,name,status:list.length?'live':'unavailable',sourceUrl:latest?.sourceUrl||extras.sourceUrl||`https://tqv.vrswebapps.com/?state=FL&county=${code.toLowerCase()}`,registered,ballots:total,turnout:registered?total/registered*100:0,...split,unallocated:list.reduce((s,r)=>s+r.unallocated,0),mail:methodReports.mail?.total||0,early:methodReports.early?.total||0,electionDay:methodReports.electionDay?.total||0,mailParty:methodReports.mail?.parties||zeroParties(),earlyParty:methodReports.early?.parties||zeroParties(),electionDayParty:methodReports.electionDay?.parties||zeroParties(),updated:latest?.reported||null,electionName:'2026 General Election',electionDate:'11/03/2026',retained:list.some(r=>r.retained),methodReports:Object.fromEntries(METHODS.map(m=>[m,validMethod(methodReports[m])?methodReports[m]:null]))};
}
/** Missing, malformed, older or future methods never erase a previously verified method. */
export function mergeCountyRows(previous:TurnoutRow[],incoming:TurnoutRow[],now=Date.now()){
 const saved=new Map<string,TurnoutRow>();
 for(const row of previous){if(!usableCounty(row))continue;const methods=reports(row);saved.set(row.code,makeCountyRow(row.code,row.name,Object.fromEntries(METHODS.map(m=>[m,validMethod(methods[m])?{...methods[m]!,retained:true}:null])),{...row,warnings:[]}));}
 for(const row of incoming){
  if(!row||!COUNTY_NAMES[row.code])continue;
  const prior=saved.get(row.code);
  if(!usableCounty(row)){if(prior)prior.warnings=[...(prior.warnings||[]),'A newer county report failed validation; previously verified methods retained.'];continue;}
  if(row.status==='unavailable'){if(prior)prior.warnings=[...(row.warnings||[]),'Latest county retrieval unavailable; previously verified methods retained.'];else saved.set(row.code,row);continue;}
  const old=prior?reports(prior):{},next=reports(row),selected:Partial<Record<Method,CountyMethod|null>>={},warnings=[...(row.warnings||[])];
  for(const method of METHODS){
   const a=old[method],b=next[method];
   if(validMethod(b)&&acceptableTime(b,now,row.fetchedAt)&&(!validMethod(a)||stampOrder(sourceStamp(b.reported),sourceStamp(a.reported))>=0))selected[method]={...b,retained:!!b.retained};
   else if(validMethod(a)){selected[method]={...a,retained:true};if(b)warnings.push(`${method}: invalid, older or future-dated incoming report; previous method retained.`);}
   else{selected[method]=null;if(b)warnings.push(`${method}: invalid or future-dated report withheld.`);}
  }
  if(METHODS.some(m=>selected[m]))saved.set(row.code,makeCountyRow(row.code,row.name,selected,{...row,warnings}));
 }
 return [...saved.values()].map(r=>({...r,stale:countyFreshness(r,now)!=='recent'}));
}
function select(county:MethodReport|null,state:MethodReport|null,warnings:string[]){if(!county)return state;if(!state)return county;if(!county.stamp){warnings.push('County timestamp unavailable; dated state report selected.');return state;}return county.stamp.day>state.activityThrough?county:state;}
const sumParties=(list:PartySplit[])=>list.reduce((a,r)=>{for(const p of PARTIES)a[p]+=r[p];return a;},zeroParties());
export function reconcileTurnout(liveRows:TurnoutRow[],state:StateReport|null,now=Date.now()){
 const stateValid=!!state&&isCurrentGeneral(state.electionName,state.electionDate)&&(!state.electionNumber||state.electionNumber==='49894');
 const states=new Map((stateValid?state!.counties:[]).filter(r=>COUNTY_NAMES[r.code]).map(r=>[r.code,r]));
 const live=new Map(mergeCountyRows([],liveRows,now).map(r=>[r.code,r]));
 const beforeElectionDay=day(now)<activeDate,active=METHODS.filter(m=>m!=='electionDay'||!beforeElectionDay),rows:SelectedCounty[]=[];
 for(const code of Object.keys(COUNTY_NAMES)){
  const r=live.get(code),s=states.get(code),raw=r?reports(r):{},warnings=[...(r?.warnings||[])],methods={} as Record<Method,MethodReport|null>;
  for(const method of METHODS){
   const record=raw[method];let county:MethodReport|null=null,official:MethodReport|null=null;
   if(validMethod(record)&&acceptableTime(record,now,r?.fetchedAt)){const stamp=sourceStamp(record.reported);county={...record,method,source:'county',reported:record.reported||'Unknown source timestamp',activityThrough:stamp?.day||'Unknown',stamp,freshness:freshness(record,now),retained:!!record.retained,note:record.note||(stamp&&!stamp.explicitZone?'Source timezone unspecified; age checked conservatively across Florida timezones.':'')};}
   if(s&&method!=='electionDay'){
    const split=method==='mail'?s.voted:s.early,stamp=sourceStamp(split?.compiled,true);
    if(split&&validSplit(split.total,split)&&stamp&&stamp.min<=now+60000)official={method,total:split.total,parties:{dem:split.dem,rep:split.rep,npa:split.npa,other:split.other},unallocated:0,source:'state',sourceUrl:stateUrl,reported:split.compiled!,activityThrough:previousDay(stamp.day),stamp,freshness:'state fallback',retained:false,note:'Delayed state compilation covering preceding-day activity, not current intraday turnout.'};
    else if(split?.total>0||split?.compiled)warnings.push(`${method}: undated or unreconciled state report excluded.`);
   }
   if(beforeElectionDay&&method==='electionDay'){methods[method]=null;if(county&&county.total!==0)warnings.push('Positive Election Day activity before November 3 excluded for review.');}else methods[method]=select(county,official,warnings);
  }
  const used=METHODS.flatMap(m=>methods[m]?[methods[m]!]:[]);
  rows.push({code,name:COUNTY_NAMES[code],methods,ballots:used.reduce((s,r)=>s+r.total,0),parties:sumParties(used.map(r=>r.parties)),unallocated:used.reduce((s,r)=>s+r.unallocated,0),missing:active.filter(m=>!methods[m]),warnings:[...new Set(warnings)]});
 }
 rows.sort((a,b)=>b.ballots-a.ballots||a.code.localeCompare(b.code));
 const totals={} as Record<Method,MethodTotal>;
 for(const method of METHODS){const used=rows.flatMap(r=>r.methods[method]?[r.methods[method]!]:[]);totals[method]={...sumParties(used.map(r=>r.parties)),total:used.reduce((s,r)=>s+r.total,0),unallocated:used.reduce((s,r)=>s+r.unallocated,0),reportedCounties:used.length,recentCounties:used.filter(r=>r.source==='county'&&r.freshness==='recent').length,fallbackCounties:used.filter(r=>r.source==='state').length,missingCounties:beforeElectionDay&&method==='electionDay'?0:67-used.length};}
 const combined={...sumParties(METHODS.map(m=>totals[m])),total:METHODS.reduce((s,m)=>s+totals[m].total,0),unallocated:METHODS.reduce((s,m)=>s+totals[m].unallocated,0)};
 const included=rows.filter(r=>active.some(m=>r.methods[m])).length,recent=rows.filter(r=>active.every(m=>r.methods[m]?.source==='county'&&r.methods[m]?.freshness==='recent')).length;
 const fallback=rows.filter(r=>active.some(m=>r.methods[m]?.source==='state')).length,delayed=rows.filter(r=>active.some(m=>r.methods[m]?.source==='county'&&r.methods[m]?.freshness!=='recent')).length;
 const partial=rows.filter(r=>r.missing.length&&active.some(m=>r.methods[m])).length,retained=rows.filter(r=>active.some(m=>r.methods[m]?.retained)).length;
 const stamps=rows.flatMap(r=>active.flatMap(m=>r.methods[m]?.stamp&&r.methods[m]?.source==='county'?[r.methods[m]!]:[])).sort((a,b)=>a.stamp!.min-b.stamp!.min);
 const reconciled=[combined,...METHODS.map(m=>totals[m])].every(r=>partySum(r)+r.unallocated===r.total)&&rows.every(r=>partySum(r.parties)+r.unallocated===r.ballots);
 return {version:RECONCILIATION_VERSION,checkedAt:new Date(now).toISOString(),beforeElectionDay,rows,totals,combined,coverage:{included,recent,fallback,delayed,retained,partial,unavailable:67-included,inventory:67,allCountyRecent:recent===67},sourceTimestamps:{oldest:stamps[0]?.reported||null,newest:stamps.at(-1)?.reported||null},reconciled,unallocated:combined.unallocated,stateValid,rejectedCountyReports:liveRows.filter(r=>!usableCounty(r)).length};
}
export type Selection=ReturnType<typeof reconcileTurnout>;
