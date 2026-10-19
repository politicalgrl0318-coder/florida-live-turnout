"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./general.module.css";
import EarlyVotingLocations from "./early-voting-locations";
import RegistrationComparison from "./registration-comparison";
import ReportingNotice from "./reporting-notice";
import snapshot from "../../public/data/general-official-snapshot.json";

type Split={rep:number;dem:number;other:number;npa:number;total:number;compiled?:string};
type CountyRow={code:string;name:string;sourceUrl:string;earlyVoting:string;provided:Split;voted:Split;early:Split;changeReturned?:number};
type Payload={generatedAt:string;compiled:string;electionName:string;electionNumber:string;electionDate:string;totals:{provided:Split;voted:Split;early:Split;changeReturned?:number};counties:CountyRow[];savedSnapshot?:boolean;reportingNote?:string};
type SortKey="name"|"sent"|"outstanding"|"returned"|"rate"|"early"|"margin";
type PartySplit={dem:number;rep:number;npa:number;other:number};
type TurnoutRow={code:string;name:string;sourceUrl:string;status:"live"|"unavailable";registered:number;ballots:number;turnout:number;mail:number;early:number;electionDay:number;dem:number;rep:number;npa:number;other:number;mailParty:PartySplit;earlyParty:PartySplit;electionDayParty:PartySplit;updated:string|null;electionName:string;electionDate:string;stale?:boolean};
type TurnoutPayload={generatedAt:string;electionName:string;electionDate:string;counties:TurnoutRow[]};
type TurnoutSortKey="name"|"ballots"|"turnout"|"mail"|"early"|"electionDay"|"dem"|"rep"|"margin"|"updated";

const number=new Intl.NumberFormat("en-US");
const pct=(v:number)=>Number.isFinite(v)?`${v.toFixed(2)}%`:"—";
const formatTime=(v:string|null)=>{
  if(!v) return "—";
  const time=new Date(v);
  return Number.isFinite(time.getTime())?new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/New_York",timeZoneName:"short"}).format(time):v;
};
const officialStats="https://countyfilesvbm-ev.floridados.gov/VoteByMailEarlyVotingReports/PublicStats";
const electionDates="https://dos.fl.gov/elections/for-voters/election-dates";
const vbmInfo="https://dos.fl.gov/elections/for-voters/voting/vote-by-mail";
const soeDirectory="https://dos.elections.myflorida.com/supervisors/";
const browardResults="https://browardvotes.gov/results-information/election-results-information";

function sent(s:Split,r:Split){return s.total+r.total}
function partySent(s:Split,r:Split,key:"rep"|"dem"|"npa"|"other"){return s[key]+r[key]}
function returnRate(row:CountyRow){const total=sent(row.provided,row.voted);return total?row.voted.total/total*100:0}
function turnoutReportUrl(row:TurnoutRow){return row.code==="BRO"?browardResults:row.sourceUrl}
function turnoutSourceLabel(row:TurnoutRow){return row.code==="BRO"?"Broward official report":"TQV live report"}
function sumParties(splits:PartySplit[]):PartySplit{return splits.reduce((a,s)=>({dem:a.dem+s.dem,rep:a.rep+s.rep,npa:a.npa+s.npa,other:a.other+s.other}),{dem:0,rep:0,npa:0,other:0})}

// Validate each county independently; one failed source must not erase the rest.
function isCurrentGeneral(name:unknown,date:unknown){
  return /general/i.test(String(name))&&/^(?:11\/0?3\/2026|2026-11-03)(?:$|T|\s)/.test(String(date));
}
function usableCounty(row:TurnoutRow){
  if(!row||typeof row.code!=="string"||!row.code.match(/^[A-Z]{3}$/)) return false;
  if(row.status==="unavailable") return true;
  if(row.status!=="live"||!isCurrentGeneral(row.electionName,row.electionDate)) return false;
  const keys=["mail","early","electionDay","ballots","registered","dem","rep","npa","other"] as const;
  if(keys.some(key=>!Number.isSafeInteger(row[key])||row[key]<0)) return false;
  const methods=[[row.mail,row.mailParty],[row.early,row.earlyParty],[row.electionDay,row.electionDayParty]] as const;
  if(methods.some(([total,split])=>!split||[split.dem,split.rep,split.npa,split.other].some(v=>!Number.isSafeInteger(v)||v<0)||total!==split.dem+split.rep+split.npa+split.other)) return false;
  return row.ballots===row.mail+row.early+row.electionDay&&(["dem","rep","npa","other"] as const).every(p=>row[p]===row.mailParty[p]+row.earlyParty[p]+row.electionDayParty[p]);
}
function mergeCountyRows(previous:TurnoutRow[],incoming:TurnoutRow[]){
  const rows=new Map(previous.map(row=>[row.code,{...row,stale:row.status==="live"}]));
  for(const row of incoming){
    if(!usableCounty(row)) continue;
    const saved=rows.get(row.code);
    if(saved?.status==="live"){
      if(row.status!=="live") continue;
      const oldTime=Date.parse(saved.updated||""),newTime=Date.parse(row.updated||"");
      if(Number.isFinite(oldTime)&&(!Number.isFinite(newTime)||newTime<oldTime)) continue;
    }
    rows.set(row.code,{...row,stale:false});
  }
  return [...rows.values()];
}
function vbmOnlySource(row:TurnoutRow){return /\/AbsenteeTurnOut\//i.test(row.sourceUrl)}
function rawMargin(values:PartySplit){const gap=values.dem-values.rep;return gap===0?"Even":`${gap>0?"D":"R"} +${number.format(Math.abs(gap))}`}

function CardPartyBreakdown({values,label,pending=false}:{values:PartySplit;label:string;pending?:boolean}){
  const colors={dem:"#2167b3",rep:"#bf3535",npa:"#596579",other:"#8155a3"};
  const total=values.dem+values.rep+values.npa+values.other;
  return <dl className={styles.cardParties} aria-label={`${label} by party`}>{(["dem","rep","npa","other"] as const).map(p=><div key={p}><dt style={{color:colors[p]}}>{p==="other"?"Other":p.toUpperCase()}</dt><dd><span>{pending?"—":number.format(values[p])}</span><small title={`Share of ${label.toLowerCase()}`}>{!pending&&total?pct(values[p]/total*100):"—"}</small></dd></div>)}</dl>;
}

export default function GeneralElection(){
  const[view,setView]=useState<"turnout"|"state">("turnout");
  const[data,setData]=useState<Payload|null>(snapshot);
  const[error,setError]=useState("");
  const[loading,setLoading]=useState(true);
  const[query,setQuery]=useState("");
  const[sort,setSort]=useState<SortKey>("sent");
  const[ascending,setAscending]=useState(false);
  const[turnoutData,setTurnoutData]=useState<TurnoutPayload|null>(null);
  const[turnoutError,setTurnoutError]=useState("");
  const[turnoutLoading,setTurnoutLoading]=useState(true);
  const[turnoutQuery,setTurnoutQuery]=useState("");
  const[turnoutSort,setTurnoutSort]=useState<TurnoutSortKey>("ballots");
  const[turnoutAscending,setTurnoutAscending]=useState(false);
  const[turnoutCheckedAt,setTurnoutCheckedAt]=useState<string|null>(null);
  const turnoutRequest=useRef(0);

  async function refreshBallotActivity(){
    setLoading(true);setError("");
    try{
      const r=await fetch(`/api/general?t=${Date.now()}`,{cache:"no-store",signal:AbortSignal.timeout(12000)});
      const body=await r.json();
      const saved=new Map<string,CountyRow>(snapshot.counties.map(c=>[c.code,c]));
      if(body.compiled===snapshot.compiled)body.counties=body.counties.map((c:CountyRow)=>({...c,changeReturned:saved.get(c.code)?.changeReturned}));
      if(!r.ok) throw new Error(body?.error||"The official Florida ballot-activity feed did not respond.");
      setData(body);
    }catch(e){setError(e instanceof Error?e.message:"Unable to load Florida general-election activity.")}
    finally{setLoading(false)}
  }

  async function refreshTurnout(){
    const requestId=++turnoutRequest.current;
    setTurnoutLoading(true);setTurnoutError("");
    try{
      const stamp=Date.now();
      const results=await Promise.allSettled(Array.from({length:5},async(_,batch)=>{
        const response=await fetch(`/api/general-turnout?batch=${batch}&t=${stamp}`,{cache:"no-store",signal:AbortSignal.timeout(20000)});
        if(!response.ok) throw new Error(`County batch ${batch+1} did not respond.`);
        const payload=await response.json() as TurnoutPayload;
        if(!Array.isArray(payload.counties)||!isCurrentGeneral(payload.electionName,payload.electionDate)) throw new Error(`County batch ${batch+1} returned an invalid election report.`);
        return payload;
      }));
      if(requestId!==turnoutRequest.current) return;
      const payloads=results.flatMap(result=>result.status==="fulfilled"?[result.value]:[]);
      const incoming=payloads.flatMap(payload=>payload.counties);
      const rejected=incoming.filter(row=>!usableCounty(row)).length;
      const failed=results.length-payloads.length;
      setTurnoutData(previous=>({
        generatedAt:payloads.map(payload=>payload.generatedAt).filter(Boolean).sort().at(-1)||previous?.generatedAt||"",
        electionName:"2026 General Election",electionDate:"11/03/2026",
        counties:mergeCountyRows(previous?.counties||[],incoming)
      }));
      if(failed||rejected) setTurnoutError(`${failed} of 5 county batches unavailable; ${rejected} county reports failed reconciliation. Successful reports are included; last verified figures are retained where available and marked stale.`);
    }catch(e){
      if(requestId===turnoutRequest.current){
        setTurnoutError(e instanceof Error?e.message:"Unable to load county turnout data.");
        setTurnoutData(previous=>previous?{...previous,counties:mergeCountyRows(previous.counties,[])}:previous);
      }
    }finally{
      if(requestId===turnoutRequest.current){setTurnoutCheckedAt(new Date().toISOString());setTurnoutLoading(false)}
    }
  }

  async function refresh(){await Promise.all([refreshBallotActivity(),refreshTurnout()])}
  useEffect(()=>{refresh();const t=setInterval(refresh,60000);return()=>{clearInterval(t);turnoutRequest.current++}},[]);

  const rows=useMemo(()=>{
    const list=(data?.counties??[]).filter(c=>c.name.toLowerCase().includes(query.toLowerCase())||c.code.toLowerCase().includes(query.toLowerCase()));
    return [...list].sort((a,b)=>{
      const value=(c:CountyRow)=>sort==="name"?c.name:sort==="sent"?sent(c.provided,c.voted):sort==="outstanding"?c.provided.total:sort==="returned"?c.voted.total:sort==="rate"?returnRate(c):sort==="early"?c.early.total:partySent(c.provided,c.voted,"dem")-partySent(c.provided,c.voted,"rep");
      const av=value(a),bv=value(b);
      return (typeof av==="string"?av.localeCompare(String(bv)):(Number(av)-Number(bv)))*(ascending?1:-1);
    });
  },[data,query,sort,ascending]);

  const turnoutRows=useMemo(()=>{
    const list=(turnoutData?.counties??[]).filter(c=>c.name.toLowerCase().includes(turnoutQuery.toLowerCase())||c.code.toLowerCase().includes(turnoutQuery.toLowerCase()));
    return [...list].sort((a,b)=>{
      const value=(c:TurnoutRow)=>turnoutSort==="name"?c.name:turnoutSort==="margin"?c.dem-c.rep:turnoutSort==="updated"?(c.updated||""):c[turnoutSort];
      const av=value(a),bv=value(b);
      return (typeof av==="string"?av.localeCompare(String(bv)):(Number(av)-Number(bv)))*(turnoutAscending?1:-1);
    });
  },[turnoutData,turnoutQuery,turnoutSort,turnoutAscending]);

  const provided=data?.totals.provided??{rep:0,dem:0,npa:0,other:0,total:0};
  const voted=data?.totals.voted??{rep:0,dem:0,npa:0,other:0,total:0};
  const early=data?.totals.early??{rep:0,dem:0,npa:0,other:0,total:0};
  const sentTotal=sent(provided,voted);
  const votedTotal=voted.total;
  const returnPct=sentTotal?votedTotal/sentTotal*100:0;
  const repSent=partySent(provided,voted,"rep"),demSent=partySent(provided,voted,"dem"),npaSent=partySent(provided,voted,"npa"),otherSent=partySent(provided,voted,"other");
  const partyTotal=repSent+demSent+npaSent+otherSent||1;
  const margin=demSent-repSent;

  // A live absentee-only report does not establish zero in-person turnout.
  // Preserve its mail counts, but label the state's early-vote fallback explicitly.
  const liveTurnout=(turnoutData?.counties.filter(c=>c.status==="live")??[]).map(c=>{
    if(!vbmOnlySource(c)) return c;
    const ev=data?.counties.find(row=>row.code===c.code)?.early;
    const earlyParty={dem:ev?.dem??0,rep:ev?.rep??0,npa:ev?.npa??0,other:ev?.other??0};
    return {...c,early:ev?.total??0,earlyParty,ballots:c.mail+(ev?.total??0),electionDay:0,electionDayParty:{dem:0,rep:0,npa:0,other:0},...sumParties([c.mailParty,earlyParty])};
  });
  const initialLiveLoading=turnoutLoading&&!turnoutData;
  const staleLiveCount=liveTurnout.filter(c=>c.stale).length;
  const refreshedLiveCount=liveTurnout.length-staleLiveCount;
  const mailOnlyCount=liveTurnout.filter(vbmOnlySource).length;
  const inPersonFeedCount=liveTurnout.filter(c=>!c.stale&&!vbmOnlySource(c)).length;
  const inPersonUnreported=liveTurnout.length<67||staleLiveCount>0||mailOnlyCount>0;
  const latestCountyUpdate=liveTurnout.map(c=>c.updated).filter((v):v is string=>!!v&&Number.isFinite(Date.parse(v))).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)||null;
  const turnoutTotals=liveTurnout.reduce((a,c)=>({registered:a.registered+c.registered,ballots:a.ballots+c.ballots,mail:a.mail+c.mail,early:a.early+c.early,electionDay:a.electionDay+c.electionDay,dem:a.dem+c.dem,rep:a.rep+c.rep,npa:a.npa+c.npa,other:a.other+c.other}),{registered:0,ballots:0,mail:0,early:0,electionDay:0,dem:0,rep:0,npa:0,other:0});
  const liveCodes=new Set(liveTurnout.map(c=>c.code));
  const stateFallback=(data?.counties??[]).filter(c=>!liveCodes.has(c.code)&&(c.voted.total>0||c.early.total>0));
  const stateReportingCount=new Set((data?.counties??[]).filter(c=>c.voted.total>0||c.early.total>0).map(c=>c.code)).size;
  const fallbackTotals=stateFallback.reduce((a,c)=>({ballots:a.ballots+c.voted.total+c.early.total,mail:a.mail+c.voted.total,early:a.early+c.early.total,dem:a.dem+c.voted.dem+c.early.dem,rep:a.rep+c.voted.rep+c.early.rep,npa:a.npa+c.voted.npa+c.early.npa,other:a.other+c.voted.other+c.early.other}),{ballots:0,mail:0,early:0,dem:0,rep:0,npa:0,other:0});
  const currentTotals={ballots:turnoutTotals.ballots+fallbackTotals.ballots,mail:turnoutTotals.mail+fallbackTotals.mail,early:turnoutTotals.early+fallbackTotals.early,electionDay:turnoutTotals.electionDay,dem:turnoutTotals.dem+fallbackTotals.dem,rep:turnoutTotals.rep+fallbackTotals.rep,npa:turnoutTotals.npa+fallbackTotals.npa,other:turnoutTotals.other+fallbackTotals.other};
  const currentReportingCount=new Set([...liveCodes,...stateFallback.map(c=>c.code)]).size;
  const turnoutPartyTotal=currentTotals.dem+currentTotals.rep+currentTotals.npa+currentTotals.other||1;
  const turnoutMargin=currentTotals.dem-currentTotals.rep;
  const liveMailReturns=liveTurnout.reduce((a,c)=>({rep:a.rep+c.mailParty.rep,dem:a.dem+c.mailParty.dem,npa:a.npa+c.mailParty.npa,other:a.other+c.mailParty.other}),{rep:0,dem:0,npa:0,other:0});
  const currentMailReturns=stateFallback.reduce((a,c)=>({rep:a.rep+c.voted.rep,dem:a.dem+c.voted.dem,npa:a.npa+c.voted.npa,other:a.other+c.voted.other}),liveMailReturns);
  const currentEarlyReturns=sumParties([...liveTurnout.map(c=>c.earlyParty),...stateFallback.map(c=>c.early)]);
  const currentElectionDayReturns=sumParties(liveTurnout.map(c=>c.electionDayParty));
  const stateCast={rep:voted.rep+early.rep,dem:voted.dem+early.dem,npa:voted.npa+early.npa,other:voted.other+early.other};


  function chooseSort(k:SortKey){if(sort===k)setAscending(!ascending);else{setSort(k);setAscending(k==="name")}}
  function chooseTurnoutSort(k:TurnoutSortKey){if(turnoutSort===k)setTurnoutAscending(!turnoutAscending);else{setTurnoutSort(k);setTurnoutAscending(k==="name")}}
  const SortButton=({k,children}:{k:SortKey;children:React.ReactNode})=><button className={styles.sort} onClick={()=>chooseSort(k)}>{children}<span>{sort===k?(ascending?"↑":"↓"):""}</span></button>;
  const TurnoutSortButton=({k,children}:{k:TurnoutSortKey;children:React.ReactNode})=><button className={styles.sort} onClick={()=>chooseTurnoutSort(k)}>{children}<span>{turnoutSort===k?(turnoutAscending?"↑":"↓"):""}</span></button>;

  return <main className={styles.page}>
    <header className={styles.hero}>
      <div className={styles.brand}><img src="/vanessa-brito.jpg" alt="Dr. Vanessa Brito, 305 Data Girl"/><div><strong><b>305</b> Data Girl</strong><span>Florida Politics with Receipts</span></div></div>
      <div className={styles.eyebrow}><i/> OFFICIAL FLORIDA ELECTION DATA</div>
      <h1>Florida General Election 2026</h1>
      <p className={styles.dek}>{view==="turnout"?"Live turnout across Florida counties as official county reporting feeds come online.":"Vote-by-Mail and Early Voting activity for the November 3 General Election, including ballots provided, returned and outstanding, plus early votes cast."}</p>
      <div className={styles.status}><span>Election 49894</span><b>•</b><span>Election Day: Nov. 3</span><b>•</b>{view==="turnout"?<><span>County feeds checked: {turnoutCheckedAt?formatTime(turnoutCheckedAt):"loading…"}</span><b>•</b><span>{initialLiveLoading?"Loading live county reports…":`${refreshedLiveCount}/67 county feeds retrieved • ${staleLiveCount} stale • ${stateFallback.length} state fallbacks`}</span></>:<span>State compilation: {data?.compiled||"loading…"} ET</span>}<button onClick={refresh} disabled={loading||turnoutLoading}>{loading||turnoutLoading?"Refreshing…":"Refresh now"}</button></div>
    </header>

    <section className={styles.deadlines} aria-label="2026 general election deadlines">
      <article><span>SEP 19</span><b>UOCAVA mail deadline</b><small>Military & overseas voters</small></article>
      <article><span>SEP 24–OCT 1</span><b>Domestic VBM mailing window</b><small>Requests already on file</small></article>
      <article><span>OCT 5</span><b>Registration deadline</b><small>Florida general election</small></article>
      <article><span>OCT 22</span><b>VBM request deadline</b><small>5:00 PM</small></article>
      <article><span>OCT 24–31</span><b>Mandatory early voting</b><small>Some counties begin Oct. 19</small></article>
      <article><span>NOV 3</span><b>Election Day</b><small>VBM due by 7:00 PM</small></article>
    </section>

    <nav className={styles.tabs} aria-label="General Election data views">
      <button className={view==="turnout"?styles.activeTab:""} onClick={()=>setView("turnout")} aria-pressed={view==="turnout"}>Live County Turnout</button>
      <button className={view==="state"?styles.activeTab:""} onClick={()=>setView("state")} aria-pressed={view==="state"}>State VBM + Early Voting</button>
    </nav>

    <section className={styles.content}>
      {view==="state"&&data&&<ReportingNotice compiled={data.compiled} counties={data.counties} reportingNote={data.reportingNote}/>}
      {view==="turnout"?<>
        {turnoutError&&<div className={styles.error}><b>County turnout feed issue:</b> {turnoutError}<button onClick={refreshTurnout}>Try again</button></div>}
        <div className={styles.phase}><span>LIVE VBM + EARLY VOTING + ELECTION DAY</span><strong>Latest reported turnout</strong><p>{initialLiveLoading?"Loading county reports. Live totals have not yet been verified in this view; a loading state does not mean early voting has not begun.":`${refreshedLiveCount} county feeds retrieved, ${staleLiveCount} retained after a failed or older refresh, and ${stateFallback.length} counties using the delayed state report. Latest county source timestamp: ${formatTime(latestCountyUpdate)}. Fallback compilation: ${data?.compiled||"unavailable"} ET.`}</p><p>Ballots cast = VBM returned + early voting + Election Day. Each county is counted once. Missing or delayed reporting is not evidence of zero voting.{mailOnlyCount>0?` ${mailOnlyCount} live source is VBM-only; its early-vote counts use the labeled state fallback, and live Election Day coverage is unavailable.`:""}</p></div>
        <RegistrationComparison cast={currentTotals} liveReturns={currentMailReturns} returns={voted} requested={{rep:repSent,dem:demSent,npa:npaSent,other:otherSent}} compiled={data?.compiled||"loading…"}>
        <div className={styles.cards}>
          <article><label>Ballots cast</label><strong>{initialLiveLoading?"—":number.format(currentTotals.ballots)}</strong><small>{initialLiveLoading?"Live reports loading":`Reported totals across ${currentReportingCount} included counties`}</small><CardPartyBreakdown values={currentTotals} label="Ballots cast" pending={initialLiveLoading}/><small>D–R margin: {initialLiveLoading?"—":rawMargin(currentTotals)}</small></article>
          <article><label>Vote by mail</label><strong>{initialLiveLoading?"—":number.format(currentTotals.mail)}</strong><small>{currentTotals.ballots?pct(currentTotals.mail/currentTotals.ballots*100):"—"} of ballots cast</small><CardPartyBreakdown values={currentMailReturns} label="Vote by mail" pending={initialLiveLoading}/><small>D–R margin: {initialLiveLoading?"—":rawMargin(currentMailReturns)}</small></article>
          <article><label>Early voting</label><strong>{initialLiveLoading?"—":number.format(currentTotals.early)}</strong><small>{initialLiveLoading?"Live reports loading":`${currentTotals.ballots?pct(currentTotals.early/currentTotals.ballots*100):"—"} of reported ballots • ${inPersonFeedCount}/67 current in-person feeds`}</small>{inPersonUnreported&&<small>Partial live coverage; delayed state figures included.</small>}<CardPartyBreakdown values={currentEarlyReturns} label="Early voting" pending={initialLiveLoading}/><small>D–R margin: {initialLiveLoading?"—":rawMargin(currentEarlyReturns)}</small></article>
          <article><label>Election Day</label><strong>{initialLiveLoading?"—":number.format(turnoutTotals.electionDay)}</strong><small>Reported activity only; unavailable feeds are not verified zeroes.</small><CardPartyBreakdown values={currentElectionDayReturns} label="Election Day" pending={initialLiveLoading}/><small>D–R margin: {initialLiveLoading?"—":rawMargin(currentElectionDayReturns)}</small></article>
        </div>
        </RegistrationComparison>
        <section className={styles.tableCard}>
          <div className={styles.tableHead}><div><h2>Live county turnout feeds</h2><p>County source timestamps are separate from the last check time. Stale rows retain the last verified report. A VBM-only source cannot establish an early-voting or Election Day count; those cells remain unreported here.</p></div><input value={turnoutQuery} onChange={e=>setTurnoutQuery(e.target.value)} placeholder="Search county or code…" aria-label="Search live turnout counties"/></div>
          <div className={styles.tableWrap}><table><thead><tr><th><TurnoutSortButton k="name">County</TurnoutSortButton></th><th><TurnoutSortButton k="ballots">Ballots cast</TurnoutSortButton></th><th><TurnoutSortButton k="turnout">Turnout</TurnoutSortButton></th><th><TurnoutSortButton k="mail">VBM</TurnoutSortButton></th><th><TurnoutSortButton k="early">Early vote</TurnoutSortButton></th><th><TurnoutSortButton k="electionDay">Election Day</TurnoutSortButton></th><th><TurnoutSortButton k="rep">REP</TurnoutSortButton></th><th><TurnoutSortButton k="dem">DEM</TurnoutSortButton></th><th>NPA</th><th><TurnoutSortButton k="margin">D–R margin</TurnoutSortButton></th><th><TurnoutSortButton k="updated">Last county update</TurnoutSortButton></th></tr></thead><tbody>{turnoutRows.map(c=><tr key={c.code}><td><a href={turnoutReportUrl(c)} target="_blank" rel="noreferrer"><b>{c.name}</b><span>{c.code} • {turnoutSourceLabel(c)}{c.stale?" • STALE — last verified":""}{vbmOnlySource(c)?" • VBM only":""} ↗</span></a></td>{c.status==="live"?<><td><b>{number.format(c.ballots)}</b></td><td><b>{c.registered>0?pct(c.turnout):"—"}</b></td><td>{number.format(c.mail)}</td><td>{vbmOnlySource(c)?"Not reported":number.format(c.early)}</td><td>{vbmOnlySource(c)?"Not reported":number.format(c.electionDay)}</td><td className={styles.rep}>{number.format(c.rep)}</td><td className={styles.dem}>{number.format(c.dem)}</td><td>{number.format(c.npa)}</td><td className={c.dem>=c.rep?styles.dem:styles.rep}>{c.dem>=c.rep?"D":"R"} +{number.format(Math.abs(c.dem-c.rep))}</td><td>{formatTime(c.updated)}</td></>:<td colSpan={10}>Live report unavailable or not verified — open county report ↗</td>}</tr>)}</tbody></table></div>
        </section>
      </>:<>
        {error&&<div className={styles.error}><b>Ballot activity feed issue:</b> {error}<button onClick={refreshBallotActivity}>Try again</button></div>}
        <div className={styles.phase}><span>STATE VBM + EARLY VOTING</span><strong>Ballot pipeline</strong><p>County-reported data compiled by the Florida Division of Elections: Vote-by-Mail ballots provided, outstanding and returned, plus early votes cast as counties begin reporting.</p></div>
        <RegistrationComparison cast={stateCast} returns={voted} requested={{rep:repSent,dem:demSent,npa:npaSent,other:otherSent}} compiled={data?.compiled||"loading…"}>
        <div className={styles.cards}>
          <article><label>VBM sent / provided</label><strong>{number.format(sentTotal)}</strong><small>Outstanding + returned</small></article>
          <article><label>Outstanding VBM</label><strong>{number.format(provided.total)}</strong><small>Provided, not yet returned</small></article>
          <article><label>Returned VBM</label><strong>{number.format(votedTotal)}</strong><small>{pct(returnPct)} return rate</small></article>
          <article><label>State early votes</label><strong>{number.format(early.total)}</strong><small>Prior-day activity; not an intraday early-vote total</small></article>
        </div>
        </RegistrationComparison>
        <section className={styles.tableCard}>
          <div className={styles.tableHead}><div><h2>State VBM + early voting by county</h2><p>County-submitted activity compiled by the Florida Division of Elections: VBM provided, outstanding and returned; return rate; and early votes cast.</p></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search county or code…" aria-label="Search ballot activity counties"/></div>
          <div className={styles.tableWrap}><table><thead><tr><th><SortButton k="name">County</SortButton></th><th><SortButton k="sent">VBM sent</SortButton></th><th><SortButton k="outstanding">Outstanding</SortButton></th><th><SortButton k="returned">Returned</SortButton></th><th><SortButton k="rate">Return rate</SortButton></th><th>Daily returns</th><th><SortButton k="early">Early votes</SortButton></th><th>REP sent</th><th>DEM sent</th><th>NPA sent</th><th><SortButton k="margin">D–R gap</SortButton></th><th>Early voting</th><th>Last report</th></tr></thead><tbody>{rows.map(c=>{const cSent=sent(c.provided,c.voted),cRep=partySent(c.provided,c.voted,"rep"),cDem=partySent(c.provided,c.voted,"dem"),cNpa=partySent(c.provided,c.voted,"npa"),cMargin=cDem-cRep;return <tr key={c.code}><td><a href={officialStats} target="_blank" rel="noreferrer"><b>{c.name}</b><span>{c.code} ↗</span></a></td><td><b>{number.format(cSent)}</b></td><td>{number.format(c.provided.total)}</td><td>{number.format(c.voted.total)}</td><td>{cSent?pct(c.voted.total/cSent*100):"—"}</td><td>{c.changeReturned===undefined?"—":number.format(c.changeReturned)}</td><td>{number.format(c.early.total)}</td><td className={styles.rep}>{number.format(cRep)}</td><td className={styles.dem}>{number.format(cDem)}</td><td>{number.format(cNpa)}</td><td className={cMargin>=0?styles.dem:styles.rep}>{cSent?`${cMargin>=0?"D":"R"} +${number.format(Math.abs(cMargin))}`:"—"}</td><td>{c.earlyVoting||"—"}</td><td>{c.provided.compiled||c.voted.compiled||c.early.compiled||"—"}</td></tr>})}</tbody></table></div>
        </section>
      </>}

      <section className={styles.actions}><div><h2>Official voter resources</h2><p>{view==="turnout"?"Live turnout comes from official county reporting: Turnout Quick View for most counties and Broward's ElectionLink reporting for Broward.":"These VBM and early-voting figures are submitted by county election officials and compiled by the Florida Division of Elections."}</p></div><div><a href={electionDates} target="_blank" rel="noreferrer">Election dates ↗</a><a href={vbmInfo} target="_blank" rel="noreferrer">Vote-by-Mail rules ↗</a><a href={soeDirectory} target="_blank" rel="noreferrer">Find your county SOE ↗</a><a href={officialStats} target="_blank" rel="noreferrer">Florida source data ↗</a></div></section>
    </section>

    <EarlyVotingLocations />
    <footer className={styles.footer}>
      <div className={styles.footerBrand}><strong><b>305</b> Data Girl</strong><span>Florida Politics with Receipts</span><span>Dr. Vanessa Brito</span></div>
      <div className={styles.footerContact}>
        <a href="mailto:politicalgrl0318@gmail.com">politicalgrl0318@gmail.com</a>
        <a href="https://www.instagram.com/vanessabritomiami" target="_blank" rel="noreferrer">Instagram @vanessabritomiami</a>
        <a href="https://www.threads.net/@vanessabritomiami" target="_blank" rel="noreferrer">Threads @vanessabritomiami</a>
        <a href="https://x.com/vanessabritomia" target="_blank" rel="noreferrer">X @vanessabritomia</a>
        <a href="https://www.facebook.com/share/1DA4uCufrb/?mibextid=wwXIfr" target="_blank" rel="noreferrer">Facebook Vanessa Brito</a>
        <a href="https://substack.com/@vanessabritomiami?r=5exhf8&utm_medium=ios&utm_source=stories&shareImageVariant=image" target="_blank" rel="noreferrer">Substack @vanessabritomiami</a>
      </div>
      <p>Sources: Florida Division of Elections Vote-by-Mail Request & Early Voting Statistics, Election 49894; Florida county Turnout Quick View reports; Broward County official ElectionLink reporting. Figures update as county election offices publish new data. Dashboard checks for updates every minute; county publication times vary. Delayed state figures and stale last-verified reports remain explicitly labeled.</p>
    </footer>
  </main>
}
