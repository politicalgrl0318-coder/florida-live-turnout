"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {COUNTY_NAMES,FRESHNESS_MINUTES,isCurrentGeneral,mergeCountyRows,METHODS,PARTIES,reconcileTurnout,RECONCILIATION_VERSION,sourceStamp,validSplit,zeroParties,type StateSplit,type TurnoutRow} from './method-selection';
import {countySeed,SEED_CHECKED_AT} from './county-seed';
import CountyResults,{PartyBreakdown,n,time,margin} from './turnout-ui';
import styles from './general.module.css';
import ui from './turnout-ui.module.css';
import EarlyVotingLocations from './early-voting-locations';
import RegistrationComparison from './registration-comparison';
import ReportingNotice from './reporting-notice';
import VerifiedUpdate from './verified-update';
import StatewideMargin from './statewide-margin';
import snapshot from '../../public/data/general-official-snapshot.json';
type CountyRow={code:string;name:string;sourceUrl:string;earlyVoting:string;provided:StateSplit;voted:StateSplit;early:StateSplit;changeReturned?:number};
type Payload={generatedAt:string;compiled:string;electionName:string;electionNumber:string;electionDate:string;totals:{provided:StateSplit;voted:StateSplit;early:StateSplit;changeReturned?:number};counties:CountyRow[];savedSnapshot?:boolean;reportingNote?:string};
type TurnoutPayload={generatedAt:string;electionNumber?:string;electionName:string;electionDate:string;counties:TurnoutRow[]};
const officialStats='https://countyfilesvbm-ev.floridados.gov/VoteByMailEarlyVotingReports/PublicStats';
const storageKey='305-49894-county-methods-v3';
const labels={mail:'Vote by mail',early:'Early voting',electionDay:'Election Day'};
const pct=(v:number)=>Number.isFinite(v)?`${v.toFixed(2)}%`:'—';
function validState(p:Payload){
 if(!p||!isCurrentGeneral(p.electionName,p.electionDate)||String(p.electionNumber)!=='49894'||!Array.isArray(p.counties)||p.counties.length!==67||p.counties.some(c=>!COUNTY_NAMES[c.code])||new Set(p.counties.map(c=>c.code)).size!==67)return false;
 for(const key of ['provided','voted','early'] as const){if(!p.totals?.[key]||!validSplit(p.totals[key].total,p.totals[key])||p.counties.some(c=>!c[key]||!validSplit(c[key].total,c[key]))||p.counties.reduce((s,c)=>s+c[key].total,0)!==p.totals[key].total||PARTIES.some(k=>p.counties.reduce((s,c)=>s+c[key][k],0)!==p.totals[key][k]))return false;}
 return !!sourceStamp(p.compiled,true);
}
export default function GeneralElection(){
 const [view,setView]=useState<'turnout'|'state'>('turnout');
 const [data,setData]=useState<Payload|null>(validState(snapshot as Payload)?snapshot as Payload:null);
 const [turnoutData,setTurnoutData]=useState<TurnoutRow[]>(()=>countySeed());
 const [loading,setLoading]=useState(true),[stateError,setStateError]=useState(''),[turnoutError,setTurnoutError]=useState('');
 const [checkedAt,setCheckedAt]=useState<string|null>(null),[now,setNow]=useState(Date.parse(SEED_CHECKED_AT));
 const [query,setQuery]=useState('');const request=useRef(0),busy=useRef(false);
 async function refresh(){
  if(busy.current)return;busy.current=true;const id=++request.current;setLoading(true);const stamp=Date.now();
  const stateTask=(async()=>{try{
   const response=await fetch(`/api/general?t=${stamp}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`State report HTTP ${response.status}`);
   const body=await response.json() as Payload;if(!validState(body))throw new Error('State report failed election or reconciliation checks.');if(id!==request.current)return;
   setData(previous=>previous&&(sourceStamp(body.compiled,true)?.min||0)<(sourceStamp(previous.compiled,true)?.min||0)?previous:body);
   setStateError(body.savedSnapshot?body.reportingNote||'Dated saved state snapshot retained.':'');
  }catch(e){if(id===request.current)setStateError(`${e instanceof Error?e.message:'State report unavailable'} The previous dated state benchmark is retained.`);}})();
  const countyTask=(async()=>{
   const results=await Promise.allSettled(Array.from({length:5},async(_,batch)=>{const response=await fetch(`/api/general-turnout?batch=${batch}&t=${stamp}`,{cache:'no-store',signal:AbortSignal.timeout(25000)});if(!response.ok)throw new Error(`County batch ${batch+1}: HTTP ${response.status}`);const payload=await response.json() as TurnoutPayload;if(!Array.isArray(payload.counties)||!isCurrentGeneral(payload.electionName,payload.electionDate)||(payload.electionNumber&&payload.electionNumber!=='49894'))throw new Error('County batch election or schema mismatch');return payload.counties;}));
   if(id!==request.current)return;const incoming=results.flatMap(r=>r.status==='fulfilled'?r.value:[]),failures=results.filter(r=>r.status==='rejected').length;
   setTurnoutData(previous=>{const rows=mergeCountyRows(previous,incoming,Date.now());try{localStorage.setItem(storageKey,JSON.stringify(rows));}catch{}return rows;});
   setTurnoutError(failures?`${failures} of 5 batches could not be retrieved. Last verified methods retain their original dates; state fallbacks are labeled.`:'');
  })();
  await Promise.allSettled([stateTask,countyTask]);if(id===request.current){const finished=Date.now();setNow(finished);setCheckedAt(new Date(finished).toISOString());setLoading(false);}busy.current=false;
 }
 useEffect(()=>{
  try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(Array.isArray(saved)&&saved.length<=67)setTurnoutData(previous=>mergeCountyRows(previous,saved,Date.now()));}catch{}
  setNow(Date.now());void refresh();const timer=setInterval(()=>{setNow(Date.now());void refresh();},60000);return()=>{clearInterval(timer);request.current++;busy.current=false;};
 },[]);
 const selected=useMemo(()=>reconcileTurnout(turnoutData,data,now),[turnoutData,data,now]);
 const ready=selected.reconciled&&selected.coverage.included>0,current=selected.combined,mail=selected.totals.mail;
 const empty:StateSplit={...zeroParties(),total:0},provided=data?.totals.provided||empty,voted=data?.totals.voted||empty,early=data?.totals.early||empty;
 const requested={dem:provided.dem+voted.dem,rep:provided.rep+voted.rep,npa:provided.npa+voted.npa,other:provided.other+voted.other},sentTotal=provided.total+voted.total;
 const overlap=snapshot.overlapCorrection.compiled===data?.compiled?snapshot.overlapCorrection:null;
 const stateCast={dem:voted.dem+early.dem-(overlap?.parties.dem||0),rep:voted.rep+early.rep-(overlap?.parties.rep||0),npa:voted.npa+early.npa-(overlap?.parties.npa||0),other:voted.other+early.other-(overlap?.parties.other||0),total:voted.total+early.total-(overlap?.total||0)};
 const conversionMatched=!!data&&data.counties.every(c=>!!c.voted.compiled&&c.voted.compiled===c.provided.compiled);
 return <main className={styles.page} data-reconciliation-version={RECONCILIATION_VERSION} data-layout-version='mobile-v3' data-selection-ready={checkedAt&&ready?'true':'false'}>
  <header className={styles.hero}>
   <div className={styles.brand}><img src='/vanessa-brito.jpg' alt='Dr. Vanessa Brito, 305 Data Girl'/><div><strong><b>305</b> Data Girl</strong><span>Florida Politics with Receipts</span></div></div>
   <div className={styles.eyebrow}><i/> OFFICIAL FLORIDA ELECTION DATA</div><h1>Florida General Election 2026</h1>
   <p className={styles.dek}>Official county turnout reports, reconciled statewide totals, and a separately dated state benchmark.</p>
   <div className={styles.status}><span>Election 49894</span><b>•</b><span>Election Day: Nov. 3</span><b>•</b><span>Last check: {checkedAt?time(checkedAt):'Loading fresh sources'}</span><button onClick={()=>void refresh()} disabled={loading}>{loading?'Refreshing…':'Refresh now'}</button></div>
  </header>
  <details className={styles.tableCard} style={{marginTop:12,padding:12}}><summary style={{cursor:'pointer',fontWeight:700}}>Voting dates and deadlines</summary><section className={styles.deadlines} aria-label='2026 general election deadlines'>
   <article><span>SEP 19</span><b>UOCAVA mail deadline</b><small>Military &amp; overseas voters</small></article><article><span>SEP 24–OCT 1</span><b>Domestic VBM mailing window</b><small>Requests already on file</small></article><article><span>OCT 5</span><b>Registration deadline</b><small>Florida general election</small></article><article><span>OCT 22</span><b>VBM request deadline</b><small>5:00 PM</small></article><article><span>OCT 24–31</span><b>Mandatory early voting</b><small>Some counties begin Oct. 19</small></article><article><span>NOV 3</span><b>Election Day</b><small>VBM due by 7:00 PM</small></article>
  </section></details>
  <nav className={styles.tabs} aria-label='General Election data views'><button className={view==='turnout'?styles.activeTab:''} aria-pressed={view==='turnout'} onClick={()=>setView('turnout')}>Live County Turnout</button><button className={view==='state'?styles.activeTab:''} aria-pressed={view==='state'} onClick={()=>setView('state')}>State VBM + Early Voting</button></nav>
  <section className={styles.content}>
   {stateError&&<div className={styles.error}><b>State-source limitation:</b> {stateError}</div>}
   {turnoutError&&view==='turnout'&&<div className={styles.error}><b>County-source limitation:</b> {turnoutError}</div>}
   {view==='turnout'?<>
    <div className={`${styles.phase} ${ui.liveStatus}`}>
     <span>{!checkedAt?'SAVED REPORTS WHILE SOURCES LOAD':selected.coverage.allCountyRecent?'RECENT COUNTY REPORTS':'MIXED-TIMESTAMP COUNTY REPORTS'}</span>
     <strong>{checkedAt?'OFFICIAL COUNTY TURNOUT':'Saved official county baseline · October 24, 6:17 p.m. EDT'}</strong>
     <p>{selected.coverage.included}/67 counties included · {selected.coverage.recent} recent · {selected.coverage.delayed} retained / delayed · {selected.coverage.fallback} with state fallbacks · {selected.coverage.partial} partial · {selected.coverage.unavailable} unavailable.</p>
     {checkedAt&&<p>Newest county source: {time(selected.sourceTimestamps.newest)}. Checked: {time(checkedAt)}.</p>}
     <details><summary>What these counts include</summary><p>One verified report per county and voting method. The cards, county rows, and download use this same selection. Recent means a source timestamp within {FRESHNESS_MINUTES} minutes; retrieval alone does not establish freshness. Coverage categories overlap. Missing is not zero. Provisional ballots are excluded; unallocated party counts remain separate. Registration is not candidate choice.</p><p>The state compilation ({data?.compiled||'unavailable'} ET) is a separate delayed benchmark, used only as a method-specific fallback where it outranks an unavailable or older county report. Live returns are never divided by a delayed outstanding-mail denominator.</p></details>
    </div>
    <div style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:16,alignItems:'center',fontSize:13,lineHeight:1.5}}><a href='#county-reports' style={{fontWeight:700,textDecoration:'underline'}}>Find a county ↓</a><span>Checks every minute. Source dates—not the refresh—determine freshness.</span></div>
    <h2 style={{margin:'12px 0'}}>Official county-method reconciliation (comparison)</h2>
    <StatewideMargin source='county' values={current} pending={!ready} coverage={`${selected.coverage.included}/67 counties included · ${selected.coverage.partial} partial · ${selected.coverage.unavailable} unavailable`} sourceNote={checkedAt?`Newest county source: ${time(selected.sourceTimestamps.newest)}. Mixed source dates and state fallbacks are detailed above.`:'Saved county reports while sources load · October 24, 6:17 p.m. EDT.'} methods={METHODS.map(method=>({id:method,label:labels[method],values:selected.totals[method],pending:!ready||!selected.totals[method].reportedCounties,notBegun:method==='electionDay'&&selected.beforeElectionDay}))}/>
    <div className={`${styles.cards} ${ui.summaryCards}`} data-live-summary>
     <article data-method='combined' data-total={ready?current.total:''}><label>Combined reported ballots</label><strong>{ready?n(current.total):'—'}</strong><div style={{margin:'8px 0 12px',fontSize:'clamp(18px,3.5vw,23px)',fontWeight:800,color:ready?(current.dem>=current.rep?'#245bb3':'#b52e32'):'#555'}}>D–R advantage: {ready?margin(current):'—'}</div><small>{selected.coverage.included}/67 counties · see coverage above</small><PartyBreakdown values={current} total={current.total} unallocated={current.unallocated} pending={!ready}/><small>Registered-party margin: <b>{ready?margin(current):'—'}</b></small></article>
     {METHODS.map(method=>{const t=selected.totals[method],notBegun=method==='electionDay'&&selected.beforeElectionDay,pending=!ready||!t.reportedCounties;return <article key={method} className={notBegun?ui.notBegun:''} data-method={method} data-total={notBegun?0:pending?'':t.total}><label>{labels[method]}</label><strong>{notBegun?'Not begun':pending?'—':n(t.total)}</strong>{!notBegun&&<div style={{margin:'8px 0 12px',fontSize:'clamp(18px,3.5vw,23px)',fontWeight:800,color:pending?'#555':t.dem>=t.rep?'#245bb3':'#b52e32'}}>D–R advantage: {pending?'—':margin(t)}</div>}<small>{notBegun?'Scheduled for November 3, 2026. No Election Day ballots included.':`${t.reportedCounties}/67 counties · ${t.recentCounties} recent · ${t.fallbackCounties} state fallbacks · ${t.missingCounties} unreported`}</small>{!notBegun&&<><PartyBreakdown values={t} total={t.total} unallocated={t.unallocated} pending={pending}/><small>Registered-party margin: <b>{pending?'—':margin(t)}</b></small></>}</article>;})}
    </div>
    {ready?<CountyResults selection={selected}/>:<p className={styles.error}>A reconciled county selection is not yet available. Missing reports are not zero.</p>}
    {ready&&conversionMatched&&data&&<details className={ui.history} style={{marginLeft:0,marginRight:0}}><summary>Turnout rates &amp; delayed state mail conversion</summary><RegistrationComparison cast={current} liveReturns={mail} returns={voted} requested={requested} compiled={data.compiled}><p className={styles.registrationNote}>The turnout counts use the same selected county methods as the cards above. Conversion uses only the separately dated, matched state snapshot.</p></RegistrationComparison></details>}
    {!conversionMatched&&<p className={styles.registrationNote}>VBM conversion is withheld until a matched returned/outstanding state snapshot is verified.</p>}
    <VerifiedUpdate/>
   </>:<>
    {data&&<ReportingNotice compiled={data.compiled} counties={data.counties} reportingNote={data.reportingNote}/>}
    <div className={`${styles.phase} ${ui.liveStatus}`}><span>DELAYED STATE BENCHMARK</span><strong>State VBM + early voting</strong><p>Election 49894 · compilation {data?.compiled||'unavailable'} ET. This is preceding-day reporting, not live intraday turnout. Blank method dates remain unreported.</p></div>
    <StatewideMargin source='state' values={stateCast} pending={!data} coverage={data?`${data.counties.length}/67 counties · Vote by mail + early voting`:'State report unavailable'} sourceNote={`State compilation: ${data?.compiled||'unavailable'} ET · preceding-day reporting.`} adjustmentNote={overlap?.total?overlap.note:undefined} methods={[{id:'mail',label:labels.mail,values:voted,pending:!data},{id:'early',label:labels.early,values:early,pending:!data}]}/>
    <div className={`${styles.cards} ${ui.summaryCards}`}><article><label>VBM sent / provided</label><strong>{data?n(sentTotal):'—'}</strong><small>Returned + outstanding, same state snapshot</small></article><article><label>Outstanding VBM</label><strong>{data?n(provided.total):'—'}</strong></article><article><label>Returned VBM</label><strong>{data?n(voted.total):'—'}</strong><small>D–R advantage: {data?margin(voted):'—'}</small><small>{conversionMatched&&sentTotal?pct(voted.total/sentTotal*100):'Conversion unverified'}</small></article><article><label>State early votes</label><strong>{data?n(early.total):'—'}</strong><small>D–R advantage: {data?margin(early):'—'}</small><small>Delayed state benchmark</small></article></div>
    {data&&conversionMatched&&<RegistrationComparison cast={stateCast} returns={voted} requested={requested} compiled={data.compiled}><p className={styles.registrationNote}>State-only benchmark. Not substituted for current county turnout. {overlap?.total?overlap.note:null}</p></RegistrationComparison>}
    <section className={styles.tableCard}><div className={styles.tableHead}><h2>State reports by county</h2><input value={query} onChange={e=>setQuery(e.target.value)} placeholder='Search county or code…' aria-label='Search state counties'/></div><div className={styles.tableWrap}><table><thead><tr><th>County</th><th>VBM sent</th><th>Outstanding</th><th>Returned</th><th>Return rate</th><th>Daily returns</th><th>Early voting</th><th>VBM D–R</th><th>Early D–R</th><th>Combined D–R</th><th>REP sent</th><th>DEM sent</th><th>NPA sent</th><th>Mail filed (ET)</th><th>Early filed (ET)</th><th>Early-voting schedule</th></tr></thead><tbody>{data?.counties.filter(c=>`${c.name} ${c.code}`.toLowerCase().includes(query.toLowerCase())).map(c=>{const sent=c.provided.total+c.voted.total,matched=!!c.voted.compiled&&c.voted.compiled===c.provided.compiled;return <tr key={c.code}><td><a href={officialStats} target='_blank' rel='noreferrer'>{c.name} ↗</a></td><td>{n(sent)}</td><td>{c.provided.compiled?n(c.provided.total):'Unreported'}</td><td>{c.voted.compiled?n(c.voted.total):'Unreported'}</td><td>{matched&&sent?pct(c.voted.total/sent*100):'—'}</td><td>{c.changeReturned===undefined?'—':n(c.changeReturned)}</td><td>{c.early.compiled?n(c.early.total):'Unreported'}</td><td>{c.voted.compiled?margin(c.voted):'—'}</td><td>{c.early.compiled?margin(c.early):'—'}</td><td>{c.voted.compiled&&c.early.compiled?margin({dem:c.voted.dem+c.early.dem,rep:c.voted.rep+c.early.rep,npa:c.voted.npa+c.early.npa,other:c.voted.other+c.early.other}):'—'}</td><td>{n(c.provided.rep+c.voted.rep)}</td><td>{n(c.provided.dem+c.voted.dem)}</td><td>{n(c.provided.npa+c.voted.npa)}</td><td>{c.voted.compiled||'Unreported'}</td><td>{c.early.compiled||'Unreported'}</td><td>{c.earlyVoting||'—'}</td></tr>;})}</tbody></table></div></section>
   </>}
   <section className={styles.actions}><div><h2>Official voter resources</h2><p>Official county TQV/ElectionLink reports and the separately labeled state compilation.</p></div><div><a href='https://dos.fl.gov/elections/for-voters/election-dates' target='_blank' rel='noreferrer'>Election dates ↗</a><a href='https://dos.fl.gov/elections/for-voters/voting/vote-by-mail' target='_blank' rel='noreferrer'>Vote-by-mail rules ↗</a><a href='https://dos.elections.myflorida.com/supervisors/' target='_blank' rel='noreferrer'>Find your county SOE ↗</a><a href={officialStats} target='_blank' rel='noreferrer'>Florida source data ↗</a></div></section>
  </section>
  <EarlyVotingLocations/>
  <footer className={styles.footer}><div className={styles.footerBrand}><strong><b>305</b> Data Girl</strong><span>Florida Politics with Receipts</span><span>Dr. Vanessa Brito</span></div><div className={styles.footerContact}><a href='mailto:politicalgrl0318@gmail.com'>politicalgrl0318@gmail.com</a><a href='https://www.instagram.com/vanessabritomiami' target='_blank' rel='noreferrer'>Instagram @vanessabritomiami</a><a href='https://www.threads.net/@vanessabritomiami' target='_blank' rel='noreferrer'>Threads @vanessabritomiami</a><a href='https://x.com/vanessabritomia' target='_blank' rel='noreferrer'>X @vanessabritomia</a><a href='https://www.facebook.com/share/1DA4uCufrb/?mibextid=wwXIfr' target='_blank' rel='noreferrer'>Facebook Vanessa Brito</a><a href='https://substack.com/@vanessabritomiami' target='_blank' rel='noreferrer'>Substack @vanessabritomiami</a></div><p>Election 49894 · Official county TQV and Broward ElectionLink independently reconciled · State compilation kept separate. All five county batches are checked every minute. Source timestamps determine freshness. Party registration is not candidate choice.</p></footer>
 </main>;
}
