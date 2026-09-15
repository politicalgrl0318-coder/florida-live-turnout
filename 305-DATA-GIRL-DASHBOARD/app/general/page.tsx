"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./general.module.css";

type Split={rep:number;dem:number;other:number;npa:number;total:number;compiled?:string};
type CountyRow={code:string;name:string;sourceUrl:string;earlyVoting:string;provided:Split;voted:Split;early:Split};
type Payload={generatedAt:string;compiled:string;electionName:string;electionNumber:string;electionDate:string;totals:{provided:Split;voted:Split;early:Split};counties:CountyRow[]};
type SortKey="name"|"sent"|"outstanding"|"returned"|"rate"|"early"|"margin";

type PartySplit={dem:number;rep:number;npa:number;other:number};
type TurnoutRow={code:string;name:string;sourceUrl:string;status:"live"|"unavailable";registered:number;ballots:number;turnout:number;mail:number;early:number;electionDay:number;dem:number;rep:number;npa:number;other:number;mailParty:PartySplit;earlyParty:PartySplit;electionDayParty:PartySplit;updated:string|null;electionName:string;electionDate:string};
type TurnoutPayload={generatedAt:string;electionName:string;electionDate:string;counties:TurnoutRow[]};
type TurnoutSortKey="name"|"ballots"|"turnout"|"mail"|"early"|"electionDay"|"dem"|"rep"|"margin"|"updated";

const number=new Intl.NumberFormat("en-US");
const pct=(v:number)=>Number.isFinite(v)?`${v.toFixed(2)}%`:"—";
const formatTime=(v:string|null)=>v?new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/New_York",timeZoneName:"short"}).format(new Date(v)):"—";
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

export default function GeneralElection(){
  const[data,setData]=useState<Payload|null>(null);
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

  async function refreshBallotActivity(){
    setLoading(true);setError("");
    try{
      const r=await fetch(`/api/general?t=${Date.now()}`,{cache:"no-store"});
      const body=await r.json();
      if(!r.ok) throw new Error(body?.error||"The official Florida ballot-activity feed did not respond.");
      setData(body);
    }catch(e){setError(e instanceof Error?e.message:"Unable to load Florida general-election activity.")}
    finally{setLoading(false)}
  }

  async function refreshTurnout(){
    setTurnoutLoading(true);setTurnoutError("");
    try{
      const stamp=Date.now();
      const responses=await Promise.all(Array.from({length:5},(_,batch)=>fetch(`/api/general-turnout?batch=${batch}&t=${stamp}`,{cache:"no-store"})));
      if(responses.some(r=>!r.ok)) throw new Error("One or more county turnout feeds did not respond.");
      const payloads=await Promise.all(responses.map(async r=>await r.json() as TurnoutPayload));
      const first=payloads.find(p=>p.counties.length)||payloads[0];
      setTurnoutData({generatedAt:payloads.map(p=>p.generatedAt).sort().at(-1)||new Date().toISOString(),electionName:first?.electionName||"2026 General Election",electionDate:first?.electionDate||"11/03/2026",counties:payloads.flatMap(p=>p.counties)});
    }catch(e){setTurnoutError(e instanceof Error?e.message:"Unable to load county turnout data.")}
    finally{setTurnoutLoading(false)}
  }

  async function refresh(){await Promise.all([refreshBallotActivity(),refreshTurnout()])}
  useEffect(()=>{refresh();const t=setInterval(refresh,300000);return()=>clearInterval(t)},[]);

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

  const liveTurnout=turnoutData?.counties.filter(c=>c.status==="live")??[];
  const turnoutTotals=liveTurnout.reduce((a,c)=>({registered:a.registered+c.registered,ballots:a.ballots+c.ballots,mail:a.mail+c.mail,early:a.early+c.early,electionDay:a.electionDay+c.electionDay,dem:a.dem+c.dem,rep:a.rep+c.rep,npa:a.npa+c.npa,other:a.other+c.other}),{registered:0,ballots:0,mail:0,early:0,electionDay:0,dem:0,rep:0,npa:0,other:0});
  const turnoutPartyTotal=turnoutTotals.dem+turnoutTotals.rep+turnoutTotals.npa+turnoutTotals.other||1;
  const turnoutMargin=turnoutTotals.dem-turnoutTotals.rep;

  function chooseSort(k:SortKey){if(sort===k)setAscending(!ascending);else{setSort(k);setAscending(k==="name")}}
  function chooseTurnoutSort(k:TurnoutSortKey){if(turnoutSort===k)setTurnoutAscending(!turnoutAscending);else{setTurnoutSort(k);setTurnoutAscending(k==="name")}}
  const SortButton=({k,children}:{k:SortKey;children:React.ReactNode})=><button className={styles.sort} onClick={()=>chooseSort(k)}>{children}<span>{sort===k?(ascending?"↑":"↓"):""}</span></button>;
  const TurnoutSortButton=({k,children}:{k:TurnoutSortKey;children:React.ReactNode})=><button className={styles.sort} onClick={()=>chooseTurnoutSort(k)}>{children}<span>{turnoutSort===k?(turnoutAscending?"↑":"↓"):""}</span></button>;

  return <main className={styles.page}>
    <header className={styles.hero}>
      <div className={styles.brand}><img src="/vanessa-brito.jpg" alt="Vanessa Brito, 305 Data Girl"/><div><strong><b>305</b> Data Girl</strong><span>Florida politics—with receipts.</span></div></div>
      <div className={styles.eyebrow}><i/> OFFICIAL FLORIDA ELECTION DATA</div>
      <h1>Florida General Election 2026</h1>
      <p className={styles.dek}>All 67 counties. One statewide view. Track the ballot pipeline and the votes actually being cast as official county turnout feeds come online.</p>
      <div className={styles.status}><span>Election 49894</span><b>•</b><span>Election Day: Nov. 3</span><b>•</b><span>{liveTurnout.length}/67 live turnout feeds</span><b>•</b><span>State compilation: {data?.compiled||"loading…"}</span><button onClick={refresh} disabled={loading||turnoutLoading}>{loading||turnoutLoading?"Refreshing…":"Refresh now"}</button></div>
    </header>

    <section className={styles.deadlines} aria-label="2026 general election deadlines">
      <article><span>SEP 19</span><b>UOCAVA mail deadline</b><small>Military & overseas voters</small></article>
      <article><span>SEP 24–OCT 1</span><b>Domestic VBM mailing window</b><small>Requests already on file</small></article>
      <article><span>OCT 5</span><b>Registration deadline</b><small>Florida general election</small></article>
      <article><span>OCT 22</span><b>VBM request deadline</b><small>5:00 PM</small></article>
      <article><span>OCT 24–31</span><b>Mandatory early voting</b><small>Some counties begin Oct. 19</small></article>
      <article><span>NOV 3</span><b>Election Day</b><small>VBM due by 7:00 PM</small></article>
    </section>

    <section className={styles.content}>
      {error&&<div className={styles.error}><b>Ballot activity feed issue:</b> {error}<button onClick={refreshBallotActivity}>Try again</button></div>}

      <div className={styles.phase}><span>BALLOT PIPELINE</span><strong>Vote-by-Mail</strong><p>These figures track ballots provided, outstanding and returned. They are not the same thing as county turnout.</p></div>

      <div className={styles.cards}>
        <article><label>VBM sent / provided</label><strong>{number.format(sentTotal)}</strong><small>Outstanding + returned</small></article>
        <article><label>Outstanding VBM</label><strong>{number.format(provided.total)}</strong><small>Provided, not yet returned</small></article>
        <article><label>Returned VBM</label><strong>{number.format(votedTotal)}</strong><small>{pct(returnPct)} return rate</small></article>
        <article><label>State EV file</label><strong>{number.format(early.total)}</strong><small>Updates when early voting begins</small></article>
      </div>

      <div className={styles.partyPanel}>
        <article><span>REP</span><strong>{number.format(repSent)}</strong><small>{pct(repSent/partyTotal*100)} of VBM sent</small></article>
        <article><span>DEM</span><strong>{number.format(demSent)}</strong><small>{pct(demSent/partyTotal*100)} of VBM sent</small></article>
        <article><span>NPA</span><strong>{number.format(npaSent)}</strong><small>{pct(npaSent/partyTotal*100)} of VBM sent</small></article>
        <article><span>OTHER</span><strong>{number.format(otherSent)}</strong><small>{pct(otherSent/partyTotal*100)} of VBM sent</small></article>
        <article className={styles.margin}><span>STATEWIDE D–R VBM GAP</span><strong className={margin>=0?styles.dem:styles.rep}>{margin>=0?"D":"R"} +{number.format(Math.abs(margin))}</strong><small>Among ballots sent / provided</small></article>
      </div>

      <section className={styles.tableCard}>
        <div className={styles.tableHead}><div><h2>County ballot activity</h2><p>State VBM and early-vote reporting by county. This is the pipeline view.</p></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search county or code…" aria-label="Search ballot activity counties"/></div>
        <div className={styles.tableWrap}><table><thead><tr>
          <th><SortButton k="name">County</SortButton></th><th><SortButton k="sent">VBM sent</SortButton></th><th><SortButton k="outstanding">Outstanding</SortButton></th><th><SortButton k="returned">Returned</SortButton></th><th><SortButton k="rate">Return rate</SortButton></th><th><SortButton k="early">Early votes</SortButton></th><th>REP sent</th><th>DEM sent</th><th>NPA sent</th><th><SortButton k="margin">D–R gap</SortButton></th><th>Early voting</th><th>Last report</th>
        </tr></thead><tbody>{rows.map(c=>{
          const cSent=sent(c.provided,c.voted),cRep=partySent(c.provided,c.voted,"rep"),cDem=partySent(c.provided,c.voted,"dem"),cNpa=partySent(c.provided,c.voted,"npa"),cMargin=cDem-cRep;
          return <tr key={c.code}><td><a href={officialStats} target="_blank" rel="noreferrer"><b>{c.name}</b><span>{c.code} ↗</span></a></td><td><b>{number.format(cSent)}</b></td><td>{number.format(c.provided.total)}</td><td>{number.format(c.voted.total)}</td><td>{cSent?pct(c.voted.total/cSent*100):"—"}</td><td>{number.format(c.early.total)}</td><td className={styles.rep}>{number.format(cRep)}</td><td className={styles.dem}>{number.format(cDem)}</td><td>{number.format(cNpa)}</td><td className={cMargin>=0?styles.dem:styles.rep}>{cSent?`${cMargin>=0?"D":"R"} +${number.format(Math.abs(cMargin))}`:"—"}</td><td>{c.earlyVoting||"—"}</td><td>{c.provided.compiled||c.voted.compiled||c.early.compiled||"—"}</td></tr>
        })}</tbody></table></div>
      </section>

      {turnoutError&&<div className={styles.error}><b>County turnout feed issue:</b> {turnoutError}<button onClick={refreshTurnout}>Try again</button></div>}

      <div className={styles.phase}><span>LIVE TURNOUT</span><strong>Votes actually cast</strong><p>{liveTurnout.length}/67 county General Election feeds are currently publishing. Most counties use Florida Turnout Quick View; Broward uses its official ElectionLink reporting.</p></div>

      <div className={styles.cards}>
        <article><label>Ballots cast</label><strong>{number.format(turnoutTotals.ballots)}</strong><small>{turnoutTotals.registered?pct(turnoutTotals.ballots/turnoutTotals.registered*100):"—"} turnout across live counties</small></article>
        <article><label>Vote by mail</label><strong>{number.format(turnoutTotals.mail)}</strong><small>{turnoutTotals.ballots?pct(turnoutTotals.mail/turnoutTotals.ballots*100):"—"} of ballots cast</small></article>
        <article><label>Early voting</label><strong>{number.format(turnoutTotals.early)}</strong><small>{turnoutTotals.ballots?pct(turnoutTotals.early/turnoutTotals.ballots*100):"—"} of ballots cast</small></article>
        <article><label>Election Day</label><strong>{number.format(turnoutTotals.electionDay)}</strong><small>{turnoutTotals.ballots?pct(turnoutTotals.electionDay/turnoutTotals.ballots*100):"—"} of ballots cast</small></article>
      </div>

      <div className={styles.partyPanel}>
        <article><span>REP</span><strong>{number.format(turnoutTotals.rep)}</strong><small>{pct(turnoutTotals.rep/turnoutPartyTotal*100)} of ballots cast</small></article>
        <article><span>DEM</span><strong>{number.format(turnoutTotals.dem)}</strong><small>{pct(turnoutTotals.dem/turnoutPartyTotal*100)} of ballots cast</small></article>
        <article><span>NPA</span><strong>{number.format(turnoutTotals.npa)}</strong><small>{pct(turnoutTotals.npa/turnoutPartyTotal*100)} of ballots cast</small></article>
        <article><span>OTHER</span><strong>{number.format(turnoutTotals.other)}</strong><small>{pct(turnoutTotals.other/turnoutPartyTotal*100)} of ballots cast</small></article>
        <article className={styles.margin}><span>STATEWIDE D–R TURNOUT MARGIN</span><strong className={turnoutMargin>=0?styles.dem:styles.rep}>{turnoutMargin>=0?"D":"R"} +{number.format(Math.abs(turnoutMargin))}</strong><small>Across counties currently publishing</small></article>
      </div>

      <section className={styles.tableCard}>
        <div className={styles.tableHead}><div><h2>Live turnout by county</h2><p>Official county turnout data: VBM, early vote, Election Day and party turnout. TQV is used for most counties; Broward links to its official ElectionLink/Broward report.</p></div><input value={turnoutQuery} onChange={e=>setTurnoutQuery(e.target.value)} placeholder="Search county or code…" aria-label="Search live turnout counties"/></div>
        <div className={styles.tableWrap}><table><thead><tr>
          <th><TurnoutSortButton k="name">County</TurnoutSortButton></th><th><TurnoutSortButton k="ballots">Ballots cast</TurnoutSortButton></th><th><TurnoutSortButton k="turnout">Turnout</TurnoutSortButton></th><th><TurnoutSortButton k="mail">VBM</TurnoutSortButton></th><th><TurnoutSortButton k="early">Early vote</TurnoutSortButton></th><th><TurnoutSortButton k="electionDay">Election Day</TurnoutSortButton></th><th><TurnoutSortButton k="rep">REP</TurnoutSortButton></th><th><TurnoutSortButton k="dem">DEM</TurnoutSortButton></th><th>NPA</th><th><TurnoutSortButton k="margin">D–R margin</TurnoutSortButton></th><th><TurnoutSortButton k="updated">Last county update</TurnoutSortButton></th>
        </tr></thead><tbody>{turnoutRows.map(c=><tr key={c.code}><td><a href={turnoutReportUrl(c)} target="_blank" rel="noreferrer"><b>{c.name}</b><span>{c.code} • {turnoutSourceLabel(c)} ↗</span></a></td>{c.status==="live"?<><td><b>{number.format(c.ballots)}</b></td><td><b>{pct(c.turnout)}</b></td><td>{number.format(c.mail)}</td><td>{number.format(c.early)}</td><td>{number.format(c.electionDay)}</td><td className={styles.rep}>{number.format(c.rep)}</td><td className={styles.dem}>{number.format(c.dem)}</td><td>{number.format(c.npa)}</td><td className={c.dem>=c.rep?styles.dem:styles.rep}>{c.dem>=c.rep?"D":"R"} +{number.format(Math.abs(c.dem-c.rep))}</td><td>{formatTime(c.updated)}</td></>:<td colSpan={10}>General Election turnout feed not published yet — open county report ↗</td>}</tr>)}</tbody></table></div>
      </section>

      <section className={styles.actions}><div><h2>Official voter resources</h2><p>The ballot-pipeline figures come from the Florida Division of Elections. Live turnout comes from official county reporting: Turnout Quick View for most counties and Broward's ElectionLink reporting for Broward. Voters should use official state or county election offices for registration, ballot requests, tracking and polling information.</p></div><div><a href={electionDates} target="_blank" rel="noreferrer">Election dates ↗</a><a href={vbmInfo} target="_blank" rel="noreferrer">Vote-by-Mail rules ↗</a><a href={soeDirectory} target="_blank" rel="noreferrer">Find your county SOE ↗</a><a href={officialStats} target="_blank" rel="noreferrer">Florida source data ↗</a></div></section>
    </section>

    <footer className={styles.footer}><div><strong>305 Data Girl</strong><span>Florida politics—with receipts.</span></div><p>Sources: Florida Division of Elections Vote-by-Mail Request & Early Voting Statistics, Election 49894; Florida county Turnout Quick View reports; Broward County official ElectionLink reporting. Figures update as county election offices publish new data. Dashboard refreshes automatically every five minutes.</p></footer>
  </main>
}
