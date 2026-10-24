/** Official Election 49894 reconciliation. Never compare retrieval time with activity time. */
export type PartySplit={dem:number;rep:number;npa:number;other:number};
export type Method="mail"|"early"|"electionDay";
export type TurnoutRow={code:string;name:string;sourceUrl:string;status:"live"|"unavailable";registered:number;ballots:number;turnout:number;mail:number;early:number;electionDay:number;dem:number;rep:number;npa:number;other:number;mailParty:PartySplit;earlyParty:PartySplit;electionDayParty:PartySplit;updated:string|null;electionName:string;electionDate:string;stale?:boolean;retained?:boolean};
export type StateSplit=PartySplit&{total:number;compiled?:string};
export type StateCounty={code:string;name:string;sourceUrl:string;voted:StateSplit;early:StateSplit};
export type StateReport={electionName:string;electionDate:string;electionNumber?:string;compiled:string;counties:StateCounty[]};
export const COUNTY_NAMES:Record<string,string>={ALA:"Alachua",BAK:"Baker",BAY:"Bay",BRA:"Bradford",BRE:"Brevard",BRO:"Broward",CAL:"Calhoun",CHA:"Charlotte",CIT:"Citrus",CLA:"Clay",CLL:"Collier",CLM:"Columbia",DAD:"Miami-Dade",DES:"DeSoto",DIX:"Dixie",DUV:"Duval",ESC:"Escambia",FLA:"Flagler",FRA:"Franklin",GAD:"Gadsden",GIL:"Gilchrist",GLA:"Glades",GUL:"Gulf",HAM:"Hamilton",HAR:"Hardee",HEN:"Hendry",HER:"Hernando",HIG:"Highlands",HIL:"Hillsborough",HOL:"Holmes",IND:"Indian River",JAC:"Jackson",JEF:"Jefferson",LAF:"Lafayette",LAK:"Lake",LEE:"Lee",LEO:"Leon",LEV:"Levy",LIB:"Liberty",MAD:"Madison",MAN:"Manatee",MRN:"Marion",MRT:"Martin",MON:"Monroe",NAS:"Nassau",OKA:"Okaloosa",OKE:"Okeechobee",ORA:"Orange",OSC:"Osceola",PAL:"Palm Beach",PAS:"Pasco",PIN:"Pinellas",POL:"Polk",PUT:"Putnam",STJ:"St. Johns",STL:"St. Lucie",SAN:"Santa Rosa",SAR:"Sarasota",SEM:"Seminole",SUM:"Sumter",SUW:"Suwannee",TAY:"Taylor",UNI:"Union",VOL:"Volusia",WAK:"Wakulla",WAL:"Walton",WAS:"Washington"};
export const METHODS:Method[]=["mail","early","electionDay"];
export const PARTIES=(['dem','rep','npa','other'] as const);
export const FRESHNESS_MINUTES=120; // A disclosed display threshold, not an assertion of complete voting activity.
export const RECONCILIATION_VERSION="2026-10-24-method-v2";
const STATE_URL="https://countyfilesvbm-ev.floridados.gov/VoteByMailEarlyVotingReports/PublicStats";
const ELECTION_DAY="2026-11-03";
export const zeroParties=():PartySplit=>({dem:0,rep:0,npa:0,other:0});
export const partySum=(s:PartySplit)=>PARTIES.reduce((n,p)=>n+s[p],0);
export function isCurrentGeneral(name:unknown,date:unknown){return /general/i.test(String(name))&&/^(?:11\/0?3\/2026|2026-11-03)(?:$|T|\s)/.test(String(date));}
export function validSplit(total:unknown,split:PartySplit|undefined){return Number.isSafeInteger(total)&&Number(total)>=0&&!!split&&PARTIES.every(p=>Number.isSafeInteger(split[p])&&split[p]>=0)&&total===partySum(split);}
export function vbmOnlySource(row:Pick<TurnoutRow,"sourceUrl">){return /\/AbsenteeTurnOut\//i.test(row.sourceUrl);}
export function usableCounty(row:TurnoutRow){
  if(!row||typeof row.code!=="string"||!COUNTY_NAMES[row.code])return false;
  if(row.status==="unavailable")return true;
  if(row.status!=="live"||!isCurrentGeneral(row.electionName,row.electionDate))return false;
  const keys=["mail","early","electionDay","ballots","registered","dem","rep","npa","other"] as const;
  if(keys.some(k=>!Number.isSafeInteger(row[k])||row[k]<0))return false;
  if(METHODS.some(m=>!validSplit(row[m],row[`${m}Party`])))return false;
  return row.ballots===row.mail+row.early+row.electionDay&&PARTIES.every(p=>row[p]===row.mailParty[p]+row.earlyParty[p]+row.electionDayParty[p]);
}
function localDay(ms:number){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));}
function previousDay(day:string){return new Date(Date.parse(day+"T12:00:00Z")-86400000).toISOString().slice(0,10);}
function zonedTime(wall:number,zone:string){
  // Resolve a local wall time without depending on the browser/server timezone.
  let guess=wall;
  for(let i=0;i<3;i++){
    const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(guess)).map(p=>[p.type,p.value]));
    const shown=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);
    guess+=wall-shown;
  }
  return guess;
}
export type Stamp={min:number;max:number;day:string;explicitZone:boolean};
/** Unzoned Florida timestamps remain a conservative Eastern/Central interval. */
export function sourceStamp(value:unknown,state=false):Stamp|null{
  if(typeof value!=="string"||!value.trim()||/^https?:/i.test(value))return null;
  const s=value.trim();
  if(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)&&/^\d{4}-\d{2}-\d{2}T/.test(s)){
    const n=Date.parse(s);return Number.isFinite(n)?{min:n,max:n,day:localDay(n),explicitZone:true}:null;
  }
  const match=s.match(/^(?:(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})\/(\d{1,2})\/(\d{4}))[ T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(AM|PM)?\s*(ET|EST|EDT|CT|CST|CDT)?$/i);
  if(!match)return null;
  const y=+(match[1]||match[6]),mo=+(match[2]||match[4]),d=+(match[3]||match[5]);
  let h=+match[7];const minute=+match[8],second=+(match[9]||0),ampm=match[10]?.toUpperCase(),zone=match[11]?.toUpperCase();
  if(ampm){if(h<1||h>12)return null;h=h%12+(ampm==="PM"?12:0);}
  if(h>23||minute>59||second>59||mo<1||mo>12||d<1||d>31)return null;
  const wall=Date.UTC(y,mo-1,d,h,minute,second);
  if(new Date(wall).getUTCMonth()!==mo-1)return null;
  const day=`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  if(zone&&['EST','EDT','CST','CDT'].includes(zone)){
    const offset=({EST:5,EDT:4,CST:6,CDT:5} as Record<string,number>)[zone];
    return {min:wall+offset*3600000,max:wall+offset*3600000,day,explicitZone:true};
  }
  const east=zonedTime(wall,"America/New_York"),central=zonedTime(wall,"America/Chicago");
  if(state||zone==="ET")return {min:east,max:east,day,explicitZone:true};
  if(zone==="CT")return {min:central,max:central,day,explicitZone:true};
  return {min:Math.min(east,central),max:Math.max(east,central),day,explicitZone:false};
}
export function countyFreshness(row:TurnoutRow,now=Date.now()){
  if(row.status!=="live")return "unavailable";
  if(row.retained)return "retained";
  const t=sourceStamp(row.updated);
  if(!t||t.min>now+300000)return "unknown";
  return now-t.min<=FRESHNESS_MINUTES*60000&&t.max<=now+300000?"recent":"delayed";
}
function compareStamps(a:Stamp|null,b:Stamp|null){
  if(a&&!b)return 1;if(!a&&b)return -1;if(!a&&!b)return 0;
  if(a!.min>b!.max)return 1;if(a!.max<b!.min)return -1;
  // Same source and same timezone semantics can still be ordered precisely.
  if(a!.explicitZone===b!.explicitZone)return Math.sign(a!.min-b!.min);
  return 0;
}
export function mergeCountyRows(previous:TurnoutRow[],incoming:TurnoutRow[],now=Date.now()){
  const rows=new Map(previous.filter(usableCounty).map(r=>[r.code,{...r,retained:r.status==="live",stale:r.status==="live"}]));
  for(const r of incoming){
    if(!usableCounty(r))continue;
    const saved=rows.get(r.code),stamp=sourceStamp(r.updated);
    if(stamp&&stamp.min>now+300000)continue;
    if(saved?.status==="live"){
      if(r.status!=="live")continue;
      if(compareStamps(stamp,sourceStamp(saved.updated))<0)continue;
      // An unparseable timestamp must not replace a dated verified report.
      if(!stamp&&sourceStamp(saved.updated))continue;
    }
    const row={...r,retained:false};
    rows.set(r.code,{...row,stale:countyFreshness(row,now)!=="recent"});
  }
  return [...rows.values()];
}
export type MethodReport={method:Method;total:number;parties:PartySplit;source:"county"|"state";sourceUrl:string;reported:string;activityThrough:string;stamp:Stamp|null;freshness:string;retained:boolean;note:string};
export type SelectedCounty={code:string;name:string;methods:Record<Method,MethodReport|null>;ballots:number;parties:PartySplit;missing:Method[];warnings:string[]};
export type MethodTotal=PartySplit&{total:number;reportedCounties:number;recentCounties:number;fallbackCounties:number;missingCounties:number};
const sumSplits=(splits:PartySplit[])=>splits.reduce((a,s)=>{PARTIES.forEach(p=>a[p]+=s[p]);return a;},zeroParties());
function selectMethod(live:MethodReport|null,state:MethodReport|null,warnings:string[]):MethodReport|null{
  if(!live)return state;if(!state)return live;
  if(!live.stamp){warnings.push("County timestamp unavailable; dated state report selected.");return state;}
  // State filing/compilation is NOT the time of the included voting activity.
  if(live.stamp.day>state.activityThrough)return live;
  if(live.stamp.day<state.activityThrough)return state;
  // State covers this complete preceding day, county report only reaches its displayed time.
  return state;
}
export function reconcileTurnout(liveRows:TurnoutRow[],state:StateReport|null,now=Date.now()){
  const stateValid=!!state&&isCurrentGeneral(state.electionName,state.electionDate)&&(!state.electionNumber||state.electionNumber==="49894");
  const states=new Map<string,StateCounty>();
  if(stateValid)for(const s of state!.counties||[])if(COUNTY_NAMES[s.code])states.set(s.code,s);
  const live=new Map<string,TurnoutRow>();
  for(const r of mergeCountyRows([],liveRows,now))if(r.status==="live"){
    // Restore the caller's retention flag; selection must not make a failed fetch fresh.
    const original=liveRows.find(x=>x.code===r.code&&x.updated===r.updated);
    live.set(r.code,{...r,retained:!!original?.retained,stale:!!original?.stale});
  }
  const codes=new Set(Object.keys(COUNTY_NAMES));
  const today=localDay(now),beforeElectionDay=today<ELECTION_DAY;
  const rows:SelectedCounty[]=[];
  for(const code of codes){
    const r=live.get(code),s=states.get(code),warnings:string[]=[];
    const methods={} as Record<Method,MethodReport|null>;
    for(const method of METHODS){
      let county:MethodReport|null=null,official:MethodReport|null=null;
      if(r&&!(vbmOnlySource(r)&&method!=="mail")){
        const stamp=sourceStamp(r.updated);
        county={method,total:r[method],parties:r[`${method}Party`],source:"county",sourceUrl:r.sourceUrl,reported:r.updated||"Unknown source timestamp",activityThrough:stamp?.day||"Unknown",stamp,freshness:countyFreshness(r,now),retained:!!r.retained,note:stamp&&!stamp.explicitZone?"Source timezone unspecified; age checked conservatively across Florida timezones.":""};
      }
      if(s&&method!=="electionDay"){
        const split=method==="mail"?s.voted:s.early;
        const stamp=sourceStamp(split?.compiled,true);
        if(split&&validSplit(split.total,split)&&stamp&&stamp.min<=now+300000){
          official={method,total:split.total,parties:{dem:split.dem,rep:split.rep,npa:split.npa,other:split.other},source:"state",sourceUrl:STATE_URL,reported:split.compiled!,activityThrough:previousDay(stamp.day),stamp,freshness:"state fallback",retained:false,note:"Prior-day coverage inferred from the state's reporting definition; compilation is not an intraday activity timestamp."};
        }else if(split?.total>0||split?.compiled)warnings.push(`${method}: state report is undated, invalid or unreconciled; excluded.`);
      }
      if(beforeElectionDay&&method==="electionDay"){
        // A scheduled non-start is not a zero established by an absentee-only feed.
        if(county&&county.total!==0)warnings.push("Positive Election Day activity before November 3 was excluded for review.");
        methods[method]=null;
      }else methods[method]=selectMethod(county,official,warnings);
    }
    const missing=METHODS.filter(m=>!(beforeElectionDay&&m==="electionDay")&&!methods[m]);
    const used=METHODS.flatMap(m=>methods[m]?[methods[m]!]:[]);
    rows.push({code,name:COUNTY_NAMES[code],methods,ballots:used.reduce((n,m)=>n+m.total,0),parties:sumSplits(used.map(m=>m.parties)),missing,warnings});
  }
  rows.sort((a,b)=>b.ballots-a.ballots||a.code.localeCompare(b.code));
  const totals={} as Record<Method,MethodTotal>;
  for(const method of METHODS){
    const used=rows.flatMap(r=>r.methods[method]?[r.methods[method]!]:[]);
    totals[method]={...sumSplits(used.map(m=>m.parties)),total:used.reduce((n,m)=>n+m.total,0),reportedCounties:used.length,recentCounties:used.filter(m=>m.source==="county"&&m.freshness==="recent").length,fallbackCounties:used.filter(m=>m.source==="state").length,missingCounties:beforeElectionDay&&method==="electionDay"?0:67-used.length};
  }
  const combined={...sumSplits(METHODS.map(m=>totals[m])),total:METHODS.reduce((n,m)=>n+totals[m].total,0)};
  const included=rows.filter(r=>METHODS.some(m=>r.methods[m])).length;
  const active=METHODS.filter(m=>!(beforeElectionDay&&m==="electionDay"));
  const recent=rows.filter(r=>active.every(m=>r.methods[m]?.source==="county"&&r.methods[m]?.freshness==="recent")).length;
  const fallback=rows.filter(r=>active.some(m=>r.methods[m]?.source==="state")).length;
  const delayed=rows.filter(r=>active.some(m=>r.methods[m]?.source==="county"&&r.methods[m]?.freshness!=="recent")).length;
  const partial=rows.filter(r=>r.missing.length>0&&active.some(m=>r.methods[m])).length;
  const allCountyRecent=recent===67;
  const reconciled=partySum(combined)===combined.total&&METHODS.every(m=>partySum(totals[m])===totals[m].total);
  return {version:RECONCILIATION_VERSION,checkedAt:new Date(now).toISOString(),beforeElectionDay,rows,totals,combined,coverage:{included,recent,fallback,delayed,partial,unavailable:67-included,inventory:codes.size,allCountyRecent},reconciled,unallocated:combined.total-partySum(combined),stateValid,rejectedCountyReports:liveRows.filter(r=>!usableCounty(r)).length};
}
