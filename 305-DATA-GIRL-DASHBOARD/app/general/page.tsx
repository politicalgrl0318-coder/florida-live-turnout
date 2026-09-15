"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./general.module.css";

type Split={rep:number;dem:number;other:number;npa:number;total:number;compiled?:string};
type CountyRow={code:string;name:string;sourceUrl:string;earlyVoting:string;provided:Split;voted:Split;early:Split};
type Payload={generatedAt:string;compiled:string;electionName:string;electionNumber:string;electionDate:string;totals:{provided:Split;voted:Split;early:Split};counties:CountyRow[]};
type SortKey="name"|"sent"|"outstanding"|"returned"|"rate"|"early"|"margin";

const number=new Intl.NumberFormat("en-US");
const pct=(v:number)=>Number.isFinite(v)?`${v.toFixed(2)}%`:"—";
const officialStats="https://countyfilesvbm-ev.floridados.gov/VoteByMailEarlyVotingReports/PublicStats";
const electionDates="https://dos.fl.gov/elections/for-voters/election-dates";
const vbmInfo="https://dos.fl.gov/elections/for-voters/voting/vote-by-mail";
const soeDirectory="https://dos.elections.myflorida.com/supervisors/";

function sent(s:Split,r:Split){return s.total+r.total}
function partySent(s:Split,r:Split,key:"rep"|"dem"|"npa"|"other"){return s[key]+r[key]}
function returnRate(row:CountyRow){const total=sent(row.provided,row.voted);return total?row.voted.total/total*100:0}

export default function GeneralElection(){
  const[data,setData]=useState<Payload|null>(null);
  const[error,setError]=useState("");
  const[loading,setLoading]=useState(true);
  const[query,setQuery]=useState("");
  const[sort,setSort]=useState<SortKey>("sent");
  const[ascending,setAscending]=useState(false);

  async function refresh(){
    setLoading(true); setError("");
    try{
      const r=await fetch(`/api/general?t=${Date.now()}`,{cache:"no-store"});
      const body=await r.json();
      if(!r.ok) throw new Error(body?.error||"The official Florida feed did not respond.");
      setData(body);
    }catch(e){setError(e instanceof Error?e.message:"Unable to load Florida general-election activity.")}
    finally{setLoading(false)}
  }

  useEffect(()=>{refresh();const t=setInterval(refresh,300000);return()=>clearInterval(t)},[]);

  const rows=useMemo(()=>{
    const list=(data?.counties??[]).filter(c=>c.name.toLowerCase().includes(query.toLowerCase())||c.code.toLowerCase().includes(query.toLowerCase()));
    return [...list].sort((a,b)=>{
      const value=(c:CountyRow)=>sort==="name"?c.name:sort==="sent"?sent(c.provided,c.voted):sort==="outstanding"?c.provided.total:sort==="returned"?c.voted.total:sort==="rate"?returnRate(c):sort==="early"?c.early.total:partySent(c.provided,c.voted,"dem")-partySent(c.provided,c.voted,"rep");
      const av=value(a),bv=value(b);
      return (typeof av==="string"?av.localeCompare(String(bv)):(Number(av)-Number(bv)))*(ascending?1:-1);
    });
  },[data,query,sort,ascending]);

  const provided=data?.totals.provided??{rep:0,dem:0,npa:0,other:0,total:0};
  const voted=data?.totals.voted??{rep:0,dem:0,npa:0,other:0,total:0};
  const early=data?.totals.early??{rep:0,dem:0,npa:0,other:0,total:0};
  const sentTotal=sent(provided,voted);
  const votedTotal=voted.total;
  const returnPct=sentTotal?votedTotal/sentTotal*100:0;
  const repSent=partySent(provided,voted,"rep"),demSent=partySent(provided,voted,"dem"),npaSent=partySent(provided,voted,"npa"),otherSent=partySent(provided,voted,"other");
  const partyTotal=repSent+demSent+npaSent+otherSent||1;
  const margin=demSent-repSent;

  function chooseSort(k:SortKey){if(sort===k)setAscending(!ascending);else{setSort(k);setAscending(k==="name")}}
  const SortButton=({k,children}:{k:SortKey;children:React.ReactNode})=><button className={styles.sort} onClick={()=>chooseSort(k)}>{children}<span>{sort===k?(ascending?"↑":"↓"):""}</span></button>;

  return <main className={styles.page}>
    <header className={styles.hero}>
      <div className={styles.brand}><img src="/vanessa-brito.jpg" alt="Vanessa Brito, 305 Data Girl"/><div><strong><b>305</b> Data Girl</strong><span>Florida politics—with receipts.</span></div></div>
      <div className={styles.eyebrow}><i/> OFFICIAL FLORIDA ELECTION DATA</div>
      <h1>Florida General Election 2026</h1>
      <p className={styles.dek}>All 67 counties. One statewide view. Vote-by-mail activity is already underway, and this dashboard will track ballots from mailing through early voting.</p>
      <div className={styles.status}><span>Election 49894</span><b>•</b><span>Election Day: Nov. 3</span><b>•</b><span>{data?.counties.length||67}/67 counties</span><b>•</b><span>State compilation: {data?.compiled||"loading…"}</span><button onClick={refresh} disabled={loading}>{loading?"Refreshing…":"Refresh now"}</button></div>
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
      {error&&<div className={styles.error}><b>Live feed issue:</b> {error}<button onClick={refresh}>Try again</button></div>}

      <div className={styles.phase}><span>LIVE PHASE</span><strong>Vote-by-Mail</strong><p>The state is already reporting ballots provided to voters. “Outstanding” means provided but not yet returned; returned ballots move into the voted VBM total.</p></div>

      <div className={styles.cards}>
        <article><label>VBM sent / provided</label><strong>{number.format(sentTotal)}</strong><small>Outstanding + returned</small></article>
        <article><label>Outstanding VBM</label><strong>{number.format(provided.total)}</strong><small>Provided, not yet returned</small></article>
        <article><label>Returned VBM</label><strong>{number.format(votedTotal)}</strong><small>{pct(returnPct)} return rate</small></article>
        <article><label>Early votes</label><strong>{number.format(early.total)}</strong><small>Updates when county EV begins</small></article>
      </div>

      <div className={styles.partyPanel}>
        <article><span>REP</span><strong>{number.format(repSent)}</strong><small>{pct(repSent/partyTotal*100)} of VBM sent</small></article>
        <article><span>DEM</span><strong>{number.format(demSent)}</strong><small>{pct(demSent/partyTotal*100)} of VBM sent</small></article>
        <article><span>NPA</span><strong>{number.format(npaSent)}</strong><small>{pct(npaSent/partyTotal*100)} of VBM sent</small></article>
        <article><span>OTHER</span><strong>{number.format(otherSent)}</strong><small>{pct(otherSent/partyTotal*100)} of VBM sent</small></article>
        <article className={styles.margin}><span>STATEWIDE D–R VBM GAP</span><strong className={margin>=0?styles.dem:styles.rep}>{margin>=0?"D":"R"} +{number.format(Math.abs(margin))}</strong><small>Among ballots sent / provided</small></article>
      </div>

      <section className={styles.tableCard}>
        <div className={styles.tableHead}><div><h2>County ballot activity</h2><p>Search or sort all 67 counties. County early-voting dates come directly from Florida’s reporting portal.</p></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search county or code…" aria-label="Search counties"/></div>
        <div className={styles.tableWrap}><table><thead><tr>
          <th><SortButton k="name">County</SortButton></th>
          <th><SortButton k="sent">VBM sent</SortButton></th>
          <th><SortButton k="outstanding">Outstanding</SortButton></th>
          <th><SortButton k="returned">Returned</SortButton></th>
          <th><SortButton k="rate">Return rate</SortButton></th>
          <th><SortButton k="early">Early votes</SortButton></th>
          <th>REP sent</th><th>DEM sent</th><th>NPA sent</th>
          <th><SortButton k="margin">D–R gap</SortButton></th>
          <th>Early voting</th><th>Last report</th>
        </tr></thead><tbody>{rows.map(c=>{
          const cSent=sent(c.provided,c.voted),cRep=partySent(c.provided,c.voted,"rep"),cDem=partySent(c.provided,c.voted,"dem"),cNpa=partySent(c.provided,c.voted,"npa"),cMargin=cDem-cRep;
          return <tr key={c.code}><td><a href={officialStats} target="_blank" rel="noreferrer"><b>{c.name}</b><span>{c.code} ↗</span></a></td><td><b>{number.format(cSent)}</b></td><td>{number.format(c.provided.total)}</td><td>{number.format(c.voted.total)}</td><td>{cSent?pct(c.voted.total/cSent*100):"—"}</td><td>{number.format(c.early.total)}</td><td className={styles.rep}>{number.format(cRep)}</td><td className={styles.dem}>{number.format(cDem)}</td><td>{number.format(cNpa)}</td><td className={cMargin>=0?styles.dem:styles.rep}>{cSent?`${cMargin>=0?"D":"R"} +${number.format(Math.abs(cMargin))}`:"—"}</td><td>{c.earlyVoting||"—"}</td><td>{c.provided.compiled||c.voted.compiled||c.early.compiled||"—"}</td></tr>
        })}</tbody></table></div>
      </section>

      <section className={styles.actions}><div><h2>Official voter resources</h2><p>The dashboard is analytical. Voters should use official state or county election offices for registration, ballot requests, tracking and polling information.</p></div><div><a href={electionDates} target="_blank" rel="noreferrer">Election dates ↗</a><a href={vbmInfo} target="_blank" rel="noreferrer">Vote-by-Mail rules ↗</a><a href={soeDirectory} target="_blank" rel="noreferrer">Find your county SOE ↗</a><a href={officialStats} target="_blank" rel="noreferrer">Florida source data ↗</a></div></section>
    </section>

    <footer className={styles.footer}><div><strong>305 Data Girl</strong><span>Florida politics—with receipts.</span></div><p>Source: Florida Division of Elections, Vote-by-Mail Request & Early Voting Statistics, Election 49894. Data are cumulative through the prior day and refresh as counties submit updates. Dashboard refreshes automatically every five minutes.</p></footer>
  </main>
}
