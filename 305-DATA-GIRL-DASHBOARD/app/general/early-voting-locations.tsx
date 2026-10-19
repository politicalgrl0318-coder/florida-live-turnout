"use client";
import {useEffect,useState} from 'react';
import snapshot from '../../public/data/general-official-snapshot.json';
import styles from './general.module.css';
type Row={id:string;name:string;address:string;dem:number;rep:number;npa:number;other:number;total:number};
type Payload={county:{code:string;name:string};updated:string;sourceUrl:string;locations:Row[]};
const n=(v:number)=>v.toLocaleString('en-US');
export default function EarlyVotingLocations(){
 const[county,setCounty]=useState('DAD'),[query,setQuery]=useState(''),[data,setData]=useState<Payload|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;const controller=new AbortController();setData(null);setLoading(true);setError('');
  async function refresh(){try{const r=await fetch(`/api/general-turnout?view=locations&county=${county}`,{cache:'no-store',signal:controller.signal});const j=await r.json();if(!r.ok)throw new Error(j.error||'Location feed unavailable');if(active){setData(j);setError('');}}catch(e){if(active)setError(e instanceof Error?e.message:'Location feed unavailable');}finally{if(active)setLoading(false);}}
  refresh();const timer=setInterval(refresh,120000);return()=>{active=false;controller.abort();clearInterval(timer);};
 },[county]);
 const rows=(data?.locations||[]).filter(r=>`${r.name} ${r.address}`.toLowerCase().includes(query.toLowerCase()));
 const totals=rows.reduce((a,r)=>({dem:a.dem+r.dem,rep:a.rep+r.rep,npa:a.npa+r.npa,other:a.other+r.other,total:a.total+r.total}),{dem:0,rep:0,npa:0,other:0,total:0});
 const updated=data?.updated?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'}).format(new Date(data.updated)):'';
 return <section className={styles.tableCard} id="early-voting-locations" aria-label="Early voting by location and party">
  <div className={styles.tableHead}><div><h2>Early voting by location &amp; party</h2><p>Live county-reported site totals. Counts include all voters at each location, regardless of congressional district. Party is registration, not candidate choice.</p><p>{updated?`County update: ${updated}. Refreshes every two minutes.`:'Choose a county to check its location feed.'}</p></div></div>
  <div style={{display:'flex',gap:16,padding:20,flexWrap:'wrap'}}><label>County <select value={county} onChange={e=>{setCounty(e.target.value);setQuery('');}}>{snapshot.counties.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label><input aria-label="Search early voting locations" placeholder="Search location or address…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
  {error&&<p role="status" style={{padding:'0 20px'}}>{data?'Last successful counts retained. ':''}{error}</p>}
  {loading?<p style={{padding:20}}>Loading official location totals…</p>:data&&<div className={styles.tableWrap}><table><thead><tr><th>Location</th><th>DEM</th><th>REP</th><th>NPA</th><th>Other</th><th>Total</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><b>{r.name}</b><span>{r.address}</span></td><td>{n(r.dem)}</td><td>{n(r.rep)}</td><td>{n(r.npa)}</td><td>{n(r.other)}</td><td><b>{n(r.total)}</b></td></tr>)}</tbody><tfoot><tr><th>Total listed sites</th><td>{n(totals.dem)}</td><td>{n(totals.rep)}</td><td>{n(totals.npa)}</td><td>{n(totals.other)}</td><td><b>{n(totals.total)}</b></td></tr></tfoot></table>{!rows.length&&<p>No sites match this search.</p>}</div>}
  {data&&<p style={{padding:20}}><a href={data.sourceUrl} target="_blank" rel="noreferrer">Official county location report ↗</a></p>}
 </section>;
}
