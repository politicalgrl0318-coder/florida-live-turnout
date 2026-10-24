"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {COUNTY_NAMES,countyFreshness,FRESHNESS_MINUTES,isCurrentGeneral,mergeCountyRows,METHODS,PARTIES,partySum,reconcileTurnout,RECONCILIATION_VERSION,sourceStamp,validSplit,zeroParties,type Method,type MethodReport,type PartySplit,type StateSplit,type TurnoutRow} from "./county-reports";
import styles from "./general.module.css";
import EarlyVotingLocations from "./early-voting-locations";
import RegistrationComparison from "./registration-comparison";
import ReportingNotice from "./reporting-notice";
import VerifiedUpdate from "./verified-update";
import snapshot from "../../public/data/general-official-snapshot.json";

type CountyRow={code:string;name:string;sourceUrl:string;earlyVoting:string;provided:StateSplit;voted:StateSplit;early:StateSplit;changeReturned?:number};
type Payload={generatedAt:string;compiled:string;electionName:string;electionNumber:string;electionDate:string;totals:{provided:StateSplit;voted:StateSplit;early:StateSplit;changeReturned?:number};counties:CountyRow[];savedSnapshot?:boolean;reportingNote?:string};
type TurnoutPayload={generatedAt:string;electionName:string;electionDate:string;counties:TurnoutRow[]};
type SortKey="name"|"ballots"|"mail"|"early"|"electionDay"|"dem"|"rep"|"margin";
const number=new Intl.NumberFormat("en-US");
const n=(v:number)=>number.format(v);
const pct=(v:number)=>Number.isFinite(v)?`${v.toFixed(2)}%`:"—";
const officialStats="https://countyfilesvbm-ev.floridados.gov/VoteByMailEarlyVotingReports/PublicStats";
const labels:Record<Method,string>={mail:"Vote by mail",early:"Early voting",electionDay:"Election Day"};
const colors={dem:"#2167b3",rep:"#bf3535",npa:"#596579",other:"#8155a3"};
function time(v:string|null){if(!v)return "—";const stamp=sourceStamp(v);return stamp?.explicitZone?new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/New_York",timeZoneName:"short"}).format(new Date(stamp.min)):v;}
function margin(v:PartySplit){const gap=v.dem-v.rep;return gap===0?"Even":`${gap>0?"D":"R"} +${n(Math.abs(gap))}`;}
function sumParties(a:PartySplit,b:PartySplit){return {dem:a.dem+b.dem,rep:a.rep+b.rep,npa:a.npa+b.npa,other:a.other+b.other};}
function validState(p:Payload){
 if(!p||!isCurrentGeneral(p.electionName,p.electionDate)||String(p.electionNumber)!=="49894"||!Array.isArray(p.counties)||p.counties.length!==67||p.counties.some(c=>!COUNTY_NAMES[c.code])||new Set(p.counties.map(c=>c.code)).size!==67)return false;
 for(const key of ["provided","voted","early"] as const){
  if(!p.totals?.[key]||!validSplit(p.totals[key].total,p.totals[key]))return false;
  if(p.counties.some(c=>!c[key]||!validSplit(c[key].total,c[key])))return false;
  if(p.counties.reduce((s,c)=>s+c[key].total,0)!==p.totals[key].total)return false;
  if(PARTIES.some(k=>p.counties.reduce((s,c)=>s+c[key][k],0)!==p.totals[key][k]))return false;
 }
 return !!sourceStamp(p.compiled,true);
}
function Breakdown({values,pending=false}:{values:PartySplit;pending?:boolean}){
 const total=partySum(values);
 return <dl className={styles.cardParties}>{PARTIES.map(p=><div key={p}><dt style={{color:colors[p]}}>{p==="other"?"Other":p.toUpperCase()}</dt><dd><span>{pending?"—":n(values[p])}</span><small>{!pending&&total?pct(values[p]/total*100):"—"}</small></dd></div>)}</dl>;
}
function Provenance({report}:{report:MethodReport|null}){
 if(!report)return <span>Not reported</span>;
 return <span><b>{n(report.total)}</b><br/><small><a href={report.sourceUrl} target="_blank" rel="noreferrer">{report.source==="state"?"STATE FALLBACK":report.retained?"RETAINED COUNTY REPORT":report.freshness==="recent"?"RECENT COUNTY REPORT":"DELAYED / UNDATED COUNTY REPORT"} ↗</a><br/>{report.source==="state"?`Activity through ${report.activityThrough}; filed ${report.reported} ET`:`Source: ${time(report.reported)}`}{report.note&&<><br/>{report.note}</>}</small></span>;
}

export default function GeneralElection(){
 const [view,setView]=useState<"turnout"|"state">("turnout");
 const [data,setData]=useState<Payload|null>(validState(snapshot as Payload)?snapshot as Payload:null);
 const [turnoutData,setTurnoutData]=useState<TurnoutRow[]>([]);
 const [loading,setLoading]=useState(true),[stateError,setStateError]=useState("");
 const [turnoutError,setTurnoutError]=useState("");
 const [checkedAt,setCheckedAt]=useState<string|null>(null),[now,setNow]=useState(0);
 const [query,setQuery]=useState(""),[sort,setSort]=useState<SortKey>("ballots"),[ascending,setAscending]=useState(false);
 const request=useRef(0),busy=useRef(false);
 async function refresh(){
  if(busy.current)return;
  busy.current=true;const id=++request.current;setLoading(true);
  const stamp=Date.now();
  const stateTask=(async()=>{
   try{
    const response=await fetch(`/api/general?t=${stamp}`,{cache:"no-store",signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error(`State report HTTP ${response.status}`);
    const body=await response.json() as Payload;
    if(!validState(body))throw new Error("State report failed election, county-inventory or party/method reconciliation checks.");
    if(id!==request.current)return;
    setData(previous=>{
     const previousTime=sourceStamp(previous?.compiled,true)?.min||0,nextTime=sourceStamp(body.compiled,true)?.min||0;
     return previous&&nextTime<previousTime?previous:body;
    });
    setStateError(body.savedSnapshot?body.reportingNote||"State source unavailable; dated saved snapshot retained.":"");
   }catch(e){if(id===request.current)setStateError(`${e instanceof Error?e.message:"State report unavailable"} The last verified state snapshot is retained, not relabeled as current.`);}
  })();
  const countyTask=(async()=>{
   const results=await Promise.allSettled(Array.from({length:5},async(_,batch)=>{
    const response=await fetch(`/api/general-turnout?batch=${batch}&t=${stamp}`,{cache:"no-store",signal:AbortSignal.timeout(22000)});
    if(!response.ok)throw new Error(`County batch ${batch+1}: HTTP ${response.status}`);
    const payload=await response.json() as TurnoutPayload;
    if(!Array.isArray(payload.counties)||!isCurrentGeneral(payload.electionName,payload.electionDate))throw new Error(`County batch ${batch+1}: election or schema mismatch`);
    return payload.counties;
   }));
   if(id!==request.current)return;
   const incoming=results.flatMap(r=>r.status==="fulfilled"?r.value:[]),failures=results.filter(r=>r.status==="rejected").length;
   setTurnoutData(previous=>mergeCountyRows(previous,incoming,Date.now()));
   setTurnoutError(failures?`${failures} of 5 county batches could not be retrieved. Retained reports and newer dated state fallbacks are reconciled below.`:"");
  })();
  await Promise.allSettled([stateTask,countyTask]);
  if(id===request.current){const finished=Date.now();setNow(finished);setCheckedAt(new Date(finished).toISOString());setLoading(false);}
  busy.current=false;
 }
 useEffect(()=>{void refresh();const timer=setInterval(()=>{setNow(Date.now());void refresh();},60000);return()=>{clearInterval(timer);request.current++;busy.current=false;};},[]);
 const selected=useMemo(()=>reconcileTurnout(turnoutData,data,now||Date.now()),[turnoutData,data,now]);
 const ready=!!checkedAt&&selected.reconciled;
 const current=selected.combined,mail=selected.totals.mail;
 const rawRejected=turnoutData.filter(r=>r.status==="unavailable").length;
 const displayed=useMemo(()=>selected.rows.filter(r=>`${r.name} ${r.code}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>{
  const value=(r:typeof a)=>sort==="name"?r.name:sort==="margin"?r.parties.dem-r.parties.rep:sort==="dem"||sort==="rep"?r.parties[sort]:sort==="ballots"?r.ballots:r.methods[sort]?.total??-1;
  const av=value(a),bv=value(b);return (typeof av==="string"?av.localeCompare(String(bv)):Number(av)-Number(bv))*(ascending?1:-1);
 }),[selected,query,sort,ascending]);
 const empty:StateSplit={...zeroParties(),total:0},provided=data?.totals.provided||empty,voted=data?.totals.voted||empty,early=data?.totals.early||empty;
 const requested=sumParties(provided,voted),sentTotal=provided.total+voted.total;
 const stateCast=sumParties(voted,early);
 const conversionMatched=!!data&&data.counties.every(c=>!!c.voted.compiled&&c.voted.compiled===c.provided.compiled);
 const choose=(key:SortKey)=>{if(sort===key)setAscending(!ascending);else{setSort(key);setAscending(key==="name");}};
 const Sort=({k,children}:{k:SortKey;children:React.ReactNode})=><button className={styles.sort} onClick={()=>choose(k)}>{children}{sort===k?(ascending?" ↑":" ↓"):""}</button>;
 const freshCount=turnoutData.filter(r=>countyFreshness(r,now||Date.now())==="recent").length;
 return <main className={styles.page} data-reconciliation-version={RECONCILIATION_VERSION}>
  <header className={styles.hero}>
   <div className={styles.brand}><img src="/vanessa-brito.jpg" alt="Dr. Vanessa Brito, 305 Data Girl"/><div><strong><b>305</b> Data Girl</strong><span>Florida Politics with Receipts</span></div></div>
   <div className={styles.eyebrow}><i/> OFFICIAL FLORIDA ELECTION DATA</div><h1>Florida General Election 2026</h1>
   <p className={styles.dek}>Latest verified county turnout, with dated state fallbacks identified by voting method.</p>
   <div className={styles.status}><span>Election 49894</span><b>•</b><span>Election Day: Nov. 3</span><b>•</b><span>Checked: {time(checkedAt)}</span><button onClick={()=>void refresh()} disabled={loading}>{loading?"Refreshing…":"Refresh now"}</button></div>
  </header>
  <details className={styles.tableCard} style={{marginTop:12,padding:12}}><summary style={{cursor:"pointer",fontWeight:700}}>Voting dates and deadlines (tap to expand)</summary><section className={styles.deadlines} aria-label="2026 general election deadlines">
   <article><span>SEP 19</span><b>UOCAVA mail deadline</b><small>Military &amp; overseas voters</small></article><article><span>SEP 24–OCT 1</span><b>Domestic VBM mailing window</b><small>Requests already on file</small></article><article><span>OCT 5</span><b>Registration deadline</b><small>Florida general election</small></article><article><span>OCT 22</span><b>VBM request deadline</b><small>5:00 PM</small></article><article><span>OCT 24–31</span><b>Mandatory early voting</b><small>Some counties begin Oct. 19</small></article><article><span>NOV 3</span><b>Election Day</b><small>VBM due by 7:00 PM</small></article>
  </section></details>
  <VerifiedUpdate/>
  <nav className={styles.tabs} aria-label="General Election data views"><button className={view==="turnout"?styles.activeTab:""} aria-pressed={view==="turnout"} onClick={()=>setView("turnout")}>Live County Turnout</button><button className={view==="state"?styles.activeTab:""} aria-pressed={view==="state"} onClick={()=>setView("state")}>State VBM + Early Voting</button></nav>
  <section className={styles.content}>
   {stateError&&<div className={styles.error}><b>State-source limitation:</b> {stateError}</div>}
   {turnoutError&&view==="turnout"&&<div className={styles.error}><b>County-source limitation:</b> {turnoutError}</div>}
   {view==="turnout"?<>
    <div className={styles.phase}><span>{ready&&selected.coverage.allCountyRecent?"RECENT COUNTY REPORTS":"MIXED-TIMESTAMP REPORTED TURNOUT"}</span><strong>Latest verified selection — not a synchronized statewide count</strong>
     <p>{!ready?"Loading and reconciling all five county batches. Missing or loading reports are not zeroes.":`${selected.coverage.included}/67 counties included • ${selected.coverage.recent} counties with recent reports for every active method • ${selected.coverage.delayed} with delayed, retained or undated county methods • ${selected.coverage.fallback} using at least one dated state fallback • ${selected.coverage.partial} partial • ${selected.coverage.unavailable} unavailable. Coverage categories can overlap.`}</p>
     <p>One selected report per county and method. Recent means the source timestamp is no more than {FRESHNESS_MINUTES} minutes old; a successful fetch does not establish freshness or complete activity. State filing times are not live voting times. All methods and parties must reconcile. Provisional ballots are excluded. Party registration is not candidate preference.</p>
     {ready&&<p>{freshCount} county feeds have recent source timestamps; {rawRejected} report unavailable at the last successful batch retrieval. State benchmark: {data?.compiled||"unavailable"} ET. The dated benchmark is kept separate from live counts and conversion denominators.</p>}
    </div>
    <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:14,alignItems:"center"}}><a href="#county-reports" style={{fontWeight:700,textDecoration:"underline"}}>Find a county ↓</a><span aria-hidden="true">•</span><span>Updated automatically every minute; “Refresh now” checks immediately.</span></div>
    <div className={styles.cards}>
     <article><label>Ballots cast — included reports</label><strong>{ready&&selected.coverage.included?n(current.total):"—"}</strong><small>{ready?`${selected.coverage.included}/67 counties; mixed method coverage`:"Verifying reports"}</small><Breakdown values={current} pending={!ready||!selected.coverage.included}/><small>D–R margin in included reports: {ready&&selected.coverage.included?margin(current):"—"}</small></article>
     {METHODS.map(m=>{const t=selected.totals[m],notBegun=m==="electionDay"&&selected.beforeElectionDay,pending=!ready||!t.reportedCounties;return <article key={m}><label>{labels[m]}</label><strong>{notBegun?"Not begun":pending?"—":n(t.total)}</strong><small>{notBegun?"Scheduled for November 3, 2026; not a feed-derived zero":`${t.reportedCounties}/67 counties reported • ${t.recentCounties} recent • ${t.fallbackCounties} state fallbacks • ${t.missingCounties} unreported`}</small>{!notBegun&&<><Breakdown values={t} pending={pending}/><small>D–R margin: {pending?"—":margin(t)}</small></>}</article>;})}
    </div>
    {ready&&selected.coverage.included>0&&conversionMatched&&data&&<RegistrationComparison cast={current} liveReturns={mail} returns={voted} requested={requested} compiled={data.compiled}><p className={styles.registrationNote}>This panel uses the reconciled method selection above. These are reported-participation rates against the labeled registration baseline, not a certification of complete current turnout. Delayed state VBM conversion is separate and never uses live mail returns.</p></RegistrationComparison>}
    {!conversionMatched&&<p className={styles.registrationNote}>VBM conversion is withheld because a matched returned/outstanding state snapshot has not been verified.</p>}
    <section className={styles.tableCard} id="county-reports">
     <div className={styles.tableHead}><div><h2>Selected county reports and source dates</h2><p>These rows sum to the cards above. Each method identifies the actual selected source. Missing is not zero; a state fallback may supersede an older retained county report.</p></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Type a county, e.g. Miami-Dade" aria-label="Search county reports"/></div>
     <div className={styles.tableWrap}><table><thead><tr><th><Sort k="name">County</Sort></th><th><Sort k="ballots">Included ballots</Sort></th>{METHODS.map(m=><th key={m}><Sort k={m}>{labels[m]}</Sort></th>)}<th><Sort k="dem">DEM</Sort></th><th><Sort k="rep">REP</Sort></th><th>NPA</th><th>Other</th><th><Sort k="margin">D–R</Sort></th></tr></thead><tbody>{ready&&displayed.map(r=><tr key={r.code}><td><b>{r.name}</b><small>{r.code}{r.missing.length?" • PARTIAL":""}</small>{r.warnings.map((w,i)=><small key={i}>{w}</small>)}</td><td>{METHODS.some(m=>r.methods[m])?n(r.ballots):"Not reported"}</td>{METHODS.map(m=><td key={m}>{m==="electionDay"&&selected.beforeElectionDay?"Not begun":<Provenance report={r.methods[m]}/>}</td>)}{PARTIES.map(p=><td key={p} style={{color:colors[p]}}>{METHODS.some(m=>r.methods[m])?n(r.parties[p]):"—"}</td>)}<td>{METHODS.some(m=>r.methods[m])?margin(r.parties):"—"}</td></tr>)}</tbody></table></div>
     <p className={styles.registrationNote}>Reconciliation: {ready?`${n(current.total)} = ${n(selected.totals.mail.total)} mail + ${n(selected.totals.early.total)} early + ${n(selected.totals.electionDay.total)} Election Day included reports; ${n(selected.unallocated)} unallocated party ballots.`:"pending"} A method with no report remains unreported even when it contributes no number to this sum. Selection version {RECONCILIATION_VERSION}.</p>
     <details><summary>Download this selected snapshot and provenance</summary><p>The export preserves reporting periods, selected sources, coverage, and the check time.</p><button disabled={!ready} onClick={()=>{const blob=new Blob([JSON.stringify(selected,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`305-data-girl-49894-${checkedAt?.replace(/[:.]/g,"-")}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Export verified selection (JSON)</button></details>
    </section>
   </>:<>
    {data&&<ReportingNotice compiled={data.compiled} counties={data.counties} reportingNote={data.reportingNote}/>}
    <div className={styles.phase}><span>DELAYED STATE BENCHMARK</span><strong>State VBM + early voting</strong><p>Election 49894; compilation {data?.compiled||"unavailable"} ET. State reports cover preceding-day activity, not live intraday turnout. Blank method dates remain unreported.</p></div>
    <div className={styles.cards}><article><label>VBM sent / provided</label><strong>{data?n(sentTotal):"—"}</strong><small>Returned + outstanding, same state snapshot</small></article><article><label>Outstanding VBM</label><strong>{data?n(provided.total):"—"}</strong></article><article><label>Returned VBM</label><strong>{data?n(voted.total):"—"}</strong><small>{conversionMatched&&sentTotal?pct(voted.total/sentTotal*100):"Conversion unverified"}</small></article><article><label>State early votes</label><strong>{data?n(early.total):"—"}</strong><small>Delayed state benchmark</small></article></div>
    {data&&conversionMatched&&<RegistrationComparison cast={stateCast} returns={voted} requested={requested} compiled={data.compiled}><p className={styles.registrationNote}>State-only benchmark. This table is not substituted for current county turnout.</p></RegistrationComparison>}
    <section className={styles.tableCard}><div className={styles.tableHead}><h2>State VBM + early voting by county</h2><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search county or code…" aria-label="Search state counties"/></div><div className={styles.tableWrap}><table><thead><tr><th>County</th><th>VBM sent</th><th>Outstanding</th><th>Returned</th><th>Return rate</th><th>Daily returns</th><th>Early voting</th><th>REP sent</th><th>DEM sent</th><th>NPA sent</th><th>Mail report filed (ET)</th><th>Early report filed (ET)</th><th>Early-voting schedule</th></tr></thead><tbody>{data?.counties.filter(c=>`${c.name} ${c.code}`.toLowerCase().includes(query.toLowerCase())).map(c=>{const sent=c.provided.total+c.voted.total,matched=!!c.voted.compiled&&c.voted.compiled===c.provided.compiled;return <tr key={c.code}><td><a href={officialStats} target="_blank" rel="noreferrer">{c.name} ↗</a></td><td>{n(sent)}</td><td>{c.provided.compiled?n(c.provided.total):"Unreported"}</td><td>{c.voted.compiled?n(c.voted.total):"Unreported"}</td><td>{matched&&sent?pct(c.voted.total/sent*100):"—"}</td><td>{c.changeReturned===undefined?"—":n(c.changeReturned)}</td><td>{c.early.compiled?n(c.early.total):"Unreported"}</td><td>{n(c.provided.rep+c.voted.rep)}</td><td>{n(c.provided.dem+c.voted.dem)}</td><td>{n(c.provided.npa+c.voted.npa)}</td><td>{c.voted.compiled||"Unreported"}</td><td>{c.early.compiled||"Unreported"}</td><td>{c.earlyVoting||"—"}</td></tr>;})}</tbody></table></div></section>
   </>}
   <section className={styles.actions}><div><h2>Official voter resources</h2><p>Official county TQV/ElectionLink reports and the separately labeled Florida state compilation. Missing live methods cannot be made current by refreshing an older report.</p></div><div><a href="https://dos.fl.gov/elections/for-voters/election-dates" target="_blank" rel="noreferrer">Election dates ↗</a><a href="https://dos.fl.gov/elections/for-voters/voting/vote-by-mail" target="_blank" rel="noreferrer">Vote-by-Mail rules ↗</a><a href="https://dos.elections.myflorida.com/supervisors/" target="_blank" rel="noreferrer">Find your county SOE ↗</a><a href={officialStats} target="_blank" rel="noreferrer">Florida source data ↗</a></div></section>
  </section>
  <EarlyVotingLocations/>
  <footer className={styles.footer}><div className={styles.footerBrand}><strong><b>305</b> Data Girl</strong><span>Florida Politics with Receipts</span><span>Dr. Vanessa Brito</span></div><div className={styles.footerContact}><a href="mailto:politicalgrl0318@gmail.com">politicalgrl0318@gmail.com</a><a href="https://www.instagram.com/vanessabritomiami" target="_blank" rel="noreferrer">Instagram @vanessabritomiami</a><a href="https://www.threads.net/@vanessabritomiami" target="_blank" rel="noreferrer">Threads @vanessabritomiami</a><a href="https://x.com/vanessabritomia" target="_blank" rel="noreferrer">X @vanessabritomia</a><a href="https://www.facebook.com/share/1DA4uCufrb/?mibextid=wwXIfr" target="_blank" rel="noreferrer">Facebook Vanessa Brito</a><a href="https://substack.com/@vanessabritomiami" target="_blank" rel="noreferrer">Substack @vanessabritomiami</a></div><p>Sources: Florida Division of Elections Election 49894; official county TQV; Broward ElectionLink. All five county batches are checked every minute. Publication times vary. Freshness is based on source timestamps, not the browser refresh. Mixed coverage, unavailable methods, retained reports and state fallbacks are labeled. Party registration is not candidate choice.</p></footer>
 </main>;
}
