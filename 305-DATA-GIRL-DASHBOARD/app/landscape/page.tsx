"use client";
import {useEffect,useMemo,useState} from "react";

type County={code:string;name:string;status:"live"|"unavailable";ballots:number;dem:number;rep:number;npa:number;other:number;updated:string|null};
type Payload={generatedAt:string;counties:County[]};
type Metric="rating"|"dem"|"rep"|"turnout"|"movement";
const nf=new Intl.NumberFormat("en-US");
const pct=(n:number)=>`${n.toFixed(1)}%`;
const rating=(c:County)=>{const two=c.dem+c.rep||1,m=(c.dem-c.rep)/two*100,a=Math.abs(m),party=m>=0?"D":"R";return{margin:m,label:`${a>=20?"Safe":a>=10?"Likely":a>=5?"Lean":"Toss Up"}${a<5?"":` ${party}`}`}};

export default function Landscape(){
 const[data,setData]=useState<Payload|null>(null),[prior,setPrior]=useState<County[]>([]),[metric,setMetric]=useState<Metric>("rating"),[query,setQuery]=useState("");
 async function refresh(){const r=await fetch(`/api/turnout?t=${Date.now()}`,{cache:"no-store"});const next=await r.json() as Payload;const saved=localStorage.getItem("305-landscape-snapshot");if(saved){try{setPrior((JSON.parse(saved) as Payload).counties||[])}catch{}}setData(next);localStorage.setItem("305-landscape-snapshot",JSON.stringify(next))}
 useEffect(()=>{refresh();const t=setInterval(refresh,300000);return()=>clearInterval(t)},[]);
 const rows=data?.counties.filter(c=>c.status==="live")||[];
 const totals=rows.reduce((a,c)=>({ballots:a.ballots+c.ballots,dem:a.dem+c.dem,rep:a.rep+c.rep,other:a.other+c.npa+c.other}),{ballots:0,dem:0,rep:0,other:0});
 const previous=new Map(prior.map(c=>[c.code,c]));
 const enriched=useMemo(()=>rows.map(c=>{const old=previous.get(c.code);return{...c,...rating(c),added:old?c.ballots-old.ballots:0,demAdded:old?c.dem-old.dem:0,repAdded:old?c.rep-old.rep:0}}),[rows,prior]);
 const filtered=enriched.filter(c=>c.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>metric==="dem"?b.dem-a.dem:metric==="rep"?b.rep-a.rep:metric==="turnout"?b.ballots-a.ballots:metric==="movement"?b.added-a.added:Math.abs(a.margin)-Math.abs(b.margin));
 const counts=enriched.reduce((a,c)=>{a[c.label]=(a[c.label]||0)+1;return a},{} as Record<string,number>);
 const movers=[...enriched].sort((a,b)=>b.added-a.added).slice(0,5);
 return <main className="landscape-page"><header className="landscape-hero"><a href="/">← 305 Data Girl dashboard</a><span>LIVE COUNTY LANDSCAPE</span><h1>Florida County Returns</h1><p>Current county turnout, partisan margins, ratings and movement—powered by the same verified feeds as the live counter.</p><div><b>{rows.length}/67 counties reporting</b><b>Updated {data?new Date(data.generatedAt).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}):"—"} ET</b><button onClick={refresh}>Refresh now</button></div></header>
 <section className="landscape-content"><div className="landscape-kpis"><article><label>Statewide margin</label><strong className={totals.dem>=totals.rep?"dem":"rep"}>{totals.dem>=totals.rep?"D":"R"}+{nf.format(Math.abs(totals.dem-totals.rep))}</strong><small>DEM {nf.format(totals.dem)} · REP {nf.format(totals.rep)}</small></article><article><label>Total ballots</label><strong>{nf.format(totals.ballots)}</strong><small>Live county feeds</small></article><article><label>Other voters</label><strong>{nf.format(totals.other)}</strong><small>NPA + other</small></article></div>
 <div className="metric-tabs">{([['rating','Rating'],['dem','DEM votes'],['rep','REP votes'],['turnout','Total turnout'],['movement','Latest movement']] as [Metric,string][]).map(([k,l])=><button key={k} className={metric===k?"active":""} onClick={()=>setMetric(k)}>{l}</button>)}</div>
 <section className="rating-strip">{['Safe R','Likely R','Lean R','Toss Up','Lean D','Likely D','Safe D'].map(k=><div key={k}><span>{k}</span><b>{counts[k]||0}</b></div>)}</section>
 {prior.length>0&&<section className="movers"><div><h2>Counties updated since your last refresh</h2><p>Largest additions captured by this browser’s previous snapshot.</p></div><div className="mover-grid">{movers.map((c,i)=><article key={c.code}><b>{i+1}. {c.name}</b><strong>+{nf.format(c.added)}</strong><small>DEM +{nf.format(c.demAdded)} · REP +{nf.format(c.repAdded)}</small></article>)}</div></section>}
 <section className="landscape-table"><div className="landscape-table-head"><div><h2>County scoreboard</h2><p>Ratings describe the current two-party turnout margin—not an election forecast.</p></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search county…"/></div><div className="table-wrap"><table><thead><tr><th>County</th><th>Rating</th><th>DEM</th><th>REP</th><th>Difference</th><th>Total</th><th>Two-party margin</th><th>Added</th></tr></thead><tbody>{filtered.map(c=><tr key={c.code}><td><b>{c.name}</b></td><td><span className={`rating-pill ${c.margin>=0?'rating-d':'rating-r'}`}>{c.label}</span></td><td className="dem">{nf.format(c.dem)}</td><td className="rep">{nf.format(c.rep)}</td><td>{nf.format(Math.abs(c.dem-c.rep))}</td><td>{nf.format(c.ballots)}</td><td className={c.margin>=0?"dem":"rep"}>{c.margin>=0?"D":"R"}+{pct(Math.abs(c.margin))}</td><td>{c.added?`+${nf.format(c.added)}`:"—"}</td></tr>)}</tbody></table></div></section>
 <p className="landscape-note">Ratings are descriptive snapshots based solely on ballots currently reported. They are not general-election projections and should not be treated as measures of county partisanship.</p></section></main>
}
