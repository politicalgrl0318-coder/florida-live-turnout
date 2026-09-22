"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import styles from "./map.module.css";

type PartySplit={dem:number;rep:number,npa:number;other:number};
type TurnoutRow={code:string;name:string;sourceUrl:string;status:"live"|"unavailable";registered:number;ballots:number;turnout:number;mail:number;early:number;electionDay:number;dem:number;rep:number;npa:number;other:number;mailParty:PartySplit;earlyParty:PartySplit;electionDayParty:PartySplit;updated:string|null;electionName:string;electionDate:string};
type TurnoutPayload={generatedAt:string;electionName:string;electionDate:string;counties:TurnoutRow[]};
type Split={rep:number;dem:number;npa:number;other:number;total:number;compiled?:string};
type StateCounty={code:string;name:string;provided:Split;voted:Split;early:Split};
type StatePayload={generatedAt:string;compiled:string;counties:StateCounty[]};
type DisplayRow=TurnoutRow&{dataSource:"county"|"state";stateCompiled?:string};
type Metric="margin"|"mail"|"ballots";

declare global{interface Window{d3:any}}

const number=new Intl.NumberFormat("en-US");
const pct=(v:number)=>Number.isFinite(v)?`${v.toFixed(2)}%`:"—";
const censusGeo="https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query?where=STATE%3D%2712%27&outFields=NAME%2CBASENAME%2CGEOID&returnGeometry=true&outSR=4326&f=geojson";
const browardResults="https://browardvotes.gov/results-information/election-results-information";
const normalize=(s:string)=>s.toLowerCase().replace(/ county$/," ").replace(/[^a-z]/g,"").trim();

function reportUrl(row:TurnoutRow){return row.code==="BRO"?browardResults:row.sourceUrl}
function formatTime(v:string|null){if(!v)return "—";const d=new Date(v);return Number.isNaN(d.valueOf())?v:new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/New_York",timeZoneName:"short"}).format(d)}

function ringArea(ring:number[][]){let area=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++){area+=(ring[j][0]*ring[i][1])-(ring[i][0]*ring[j][1])}return area/2}
function rewindGeometry(geometry:any){
 if(!geometry)return geometry;
 const rewindPolygon=(rings:number[][][])=>rings.map((ring,i)=>{const shouldClockwise=i===0;const clockwise=ringArea(ring)<0;return clockwise===shouldClockwise?ring:[...ring].reverse()});
 if(geometry.type==="Polygon")return {...geometry,coordinates:rewindPolygon(geometry.coordinates)};
 if(geometry.type==="MultiPolygon")return {...geometry,coordinates:geometry.coordinates.map((poly:number[][][])=>rewindPolygon(poly))};
 return geometry;
}

export default function TurnoutMap(){
 const[rows,setRows]=useState<TurnoutRow[]>([]),[stateRows,setStateRows]=useState<StateCounty[]>([]),[stateCompiled,setStateCompiled]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const[metric,setMetric]=useState<Metric>("margin"),[selected,setSelected]=useState<DisplayRow|null>(null),[geo,setGeo]=useState<any>(null),[mapError,setMapError]=useState("");
 const svgRef=useRef<SVGSVGElement|null>(null);

 async function refresh(){setLoading(true);setError("");try{const stamp=Date.now();const [stateResponse,...responses]=await Promise.all([fetch(`/api/general?t=${stamp}`,{cache:"no-store"}),...Array.from({length:5},(_,batch)=>fetch(`/api/general-turnout?batch=${batch}&t=${stamp}`,{cache:"no-store"}))]);if(!stateResponse.ok||responses.some(r=>!r.ok))throw new Error("One or more official election feeds did not respond.");const state=await stateResponse.json() as StatePayload;const payloads=await Promise.all(responses.map(r=>r.json() as Promise<TurnoutPayload>));setStateRows(state.counties||[]);setStateCompiled(state.compiled||"");setRows(payloads.flatMap(p=>p.counties));}catch(e){setError(e instanceof Error?e.message:"Unable to load official election data.")}finally{setLoading(false)}}

 useEffect(()=>{refresh();const t=setInterval(refresh,300000);return()=>clearInterval(t)},[]);
 useEffect(()=>{fetch(censusGeo).then(r=>{if(!r.ok)throw new Error("Census geography unavailable");return r.json()}).then((g:any)=>setGeo({...g,features:(g.features||[]).map((f:any)=>({...f,geometry:rewindGeometry(f.geometry)}))})).catch(()=>setMapError("The Census county-boundary layer did not load."))},[]);
 useEffect(()=>{if(window.d3)return;const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js";s.async=true;s.onload=()=>setGeo((g:any)=>g?{...g}:g);s.onerror=()=>setMapError("The map renderer did not load.");document.head.appendChild(s)},[]);

 const live=useMemo(()=>rows.filter(r=>r.status==="live"),[rows]);
 const displayRows=useMemo<DisplayRow[]>(()=>{const stateMap=new Map(stateRows.map(r=>[r.code,r]));return rows.map(r=>{if(r.status==="live")return {...r,dataSource:"county" as const};const v=stateMap.get(r.code);const ballots=(v?.voted.total||0)+(v?.early.total||0);if(!v||ballots===0)return {...r,dataSource:"state" as const,stateCompiled};const dem=v.voted.dem+v.early.dem,rep=v.voted.rep+v.early.rep,npa=v.voted.npa+v.early.npa,other=v.voted.other+v.early.other;return {...r,status:"live" as const,ballots,mail:v.voted.total,early:v.early.total,electionDay:0,dem,rep,npa,other,mailParty:{dem:v.voted.dem,rep:v.voted.rep,npa:v.voted.npa,other:v.voted.other},earlyParty:{dem:v.early.dem,rep:v.early.rep,npa:v.early.npa,other:v.early.other},updated:v.voted.compiled||v.early.compiled||stateCompiled||null,dataSource:"state" as const,stateCompiled};});},[rows,stateRows,stateCompiled]);
 const reporting=useMemo(()=>displayRows.filter(r=>r.status==="live"),[displayRows]);
 const totals=useMemo(()=>reporting.reduce((a,c)=>({ballots:a.ballots+c.ballots,registered:a.registered+c.registered,dem:a.dem+c.dem,rep:a.rep+c.rep,npa:a.npa+c.npa,other:a.other+c.other}),{ballots:0,registered:0,dem:0,rep:0,npa:0,other:0}),[reporting]);
 const partyTotal=totals.dem+totals.rep+totals.npa+totals.other||1;
 const rowMap=useMemo(()=>new Map(displayRows.map(r=>[normalize(r.name),r])),[displayRows]);

 useEffect(()=>{
   if(!geo||!svgRef.current||!window.d3)return;
   const d3=window.d3,svg=d3.select(svgRef.current);svg.selectAll("*").remove();
   const width=900,height=600,features=(geo.features||[]) as any[];
   if(!features.length){setMapError("Florida county geography did not contain any counties.");return}
   const collection={type:"FeatureCollection",features};
   const projection=d3.geoMercator().fitExtent([[24,24],[width-24,height-24]],collection);const path=d3.geoPath(projection);
   const maxBallots=Math.max(1,...reporting.map(r=>r.ballots));
   const fill=(r:TurnoutRow|undefined)=>{if(!r||r.status!=="live")return "#e4e2dc";if(metric==="margin"){const m=r.dem-r.rep;if(m>0)return "#3b82d0";if(m<0)return "#d85b50";return "#9b70d8"}if(metric==="mail"){const maxMail=Math.max(1,...reporting.map(x=>x.mail));const v=Math.sqrt(r.mail/maxMail);return d3.interpolateBlues(.18+.72*v)}const v=Math.sqrt(r.ballots/maxBallots);return d3.interpolateTeal(.18+.72*v)};
   svg.attr("viewBox",`0 0 ${width} ${height}`);
   svg.append("g").selectAll("path").data(features).join("path").attr("d",path).attr("fill",(f:any)=>fill(rowMap.get(normalize(f.properties?.BASENAME||f.properties?.NAME||"")))).attr("stroke","#172033").attr("stroke-width",1.25).style("cursor","pointer").attr("tabindex",0).attr("role","button").attr("aria-label",(f:any)=>`${f.properties?.BASENAME||f.properties?.NAME||"Florida county"} turnout details`).on("click",(_:any,f:any)=>{const r=rowMap.get(normalize(f.properties?.BASENAME||f.properties?.NAME||""));setSelected(r||null)}).on("keydown",(e:any,f:any)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();const r=rowMap.get(normalize(f.properties?.BASENAME||f.properties?.NAME||""));setSelected(r||null)}});
 },[geo,rowMap,metric,reporting]);

 const statewideMargin=totals.dem-totals.rep;
 return <main className={styles.page}>
   <header className={styles.hero}><div><a href="/general" className={styles.back}>← General Election Dashboard</a><span className={styles.kicker}>305 DATA GIRL • FLORIDA BALLOT ACTIVITY</span><h1>Florida 2026 Interactive Turnout Map</h1><p>Click any county to see ballots already cast. Before county live feeds activate, the map uses official Florida county VBM-return and Early Voting files, then automatically prioritizes TQV/ElectionLink data as those feeds come online.</p></div><button onClick={refresh} disabled={loading}>{loading?"Refreshing…":"Refresh now"}</button></header>
   {error&&<div className={styles.error}>{error}</div>}
   <section className={styles.summary}><article><span>COUNTIES REPORTING CAST BALLOTS</span><b>{reporting.length}/67</b><small>{live.length?`${live.length} county live feed${live.length===1?"":"s"} active`:"State VBM/EV files active"}</small></article><article><span>BALLOTS CAST</span><b>{number.format(totals.ballots)}</b></article><article><span>DEM</span><b>{number.format(totals.dem)} <small>{pct(totals.dem/partyTotal*100)}</small></b></article><article><span>REP</span><b>{number.format(totals.rep)} <small>{pct(totals.rep/partyTotal*100)}</small></b></article><article><span>D–R TURNOUT MARGIN</span><b>{statewideMargin>=0?"D":"R"} +{number.format(Math.abs(statewideMargin))}</b></article></section>
   <section className={styles.mapCard}>
    <div className={styles.mapTop}><div><h2>County ballot activity</h2><p>Party colors represent the registration of voters who have cast ballots — not candidate vote totals.</p></div><div className={styles.controls} aria-label="Map metric"><button className={metric==="margin"?styles.active:""} onClick={()=>setMetric("margin")}>D–R margin</button><button className={metric==="mail"?styles.active:""} onClick={()=>setMetric("mail")}>VBM returns</button><button className={metric==="ballots"?styles.active:""} onClick={()=>setMetric("ballots")}>Ballots cast</button></div></div>
    <div className={styles.mapGrid}><div className={styles.mapWrap}>{mapError?<div className={styles.mapError}>{mapError}</div>:<svg ref={svgRef} className={styles.map} aria-label="Interactive map of Florida county turnout"/>}<div className={styles.legend}>{metric==="margin"?<><span><i className={styles.blue}/>DEM turnout lead</span><span><i className={styles.red}/>REP turnout lead</span><span><i className={styles.purple}/>Tie</span></>:<span>Dark = higher {metric==="mail"?"VBM returns":"ballot volume"}</span>}<span><i className={styles.gray}/>No cast ballots reported yet</span></div></div>
    <aside className={styles.detail}>{selected?<><span className={styles.detailLabel}>SELECTED COUNTY</span><h3>{selected.name}</h3>{selected.status==="live"?<><div className={styles.big}>{number.format(selected.ballots)}<small> ballots cast</small></div><dl>{selected.dataSource==="county"&&<div><dt>Turnout</dt><dd>{pct(selected.turnout)}</dd></div>}<div><dt>VBM returned</dt><dd>{number.format(selected.mail)}</dd></div><div><dt>Early vote</dt><dd>{number.format(selected.early)}</dd></div>{selected.dataSource==="county"&&<div><dt>Election Day</dt><dd>{number.format(selected.electionDay)}</dd></div>}<div><dt>DEM</dt><dd>{number.format(selected.dem)}</dd></div><div><dt>REP</dt><dd>{number.format(selected.rep)}</dd></div><div><dt>NPA</dt><dd>{number.format(selected.npa)}</dd></div><div><dt>D–R margin</dt><dd>{selected.dem>=selected.rep?"D":"R"} +{number.format(Math.abs(selected.dem-selected.rep))}</dd></div></dl><small>Source: {selected.dataSource==="county"?"live county turnout feed":"Florida Division of Elections county VBM/EV file"} • Update: {formatTime(selected.updated)}</small><a href={selected.dataSource==="county"?reportUrl(selected):"https://countyfilesvbm-ev.floridados.gov/VoteByMailEarlyVotingReports/PublicStats"} target="_blank" rel="noreferrer">Open official source ↗</a></>:<><p>No returned VBM or Early Voting ballots are currently reported for this county, and its live county turnout feed has not activated yet.</p><a href="https://countyfilesvbm-ev.floridados.gov/VoteByMailEarlyVotingReports/PublicStats" target="_blank" rel="noreferrer">Check Florida reporting ↗</a></>}</>:<><span className={styles.detailLabel}>EXPLORE THE MAP</span><h3>Tap a county</h3><p>Select any county for its current VBM returns, Early Voting activity and party-registration breakdown. Live county feeds replace the state-file fallback automatically when available.</p></>}</aside></div>
   </section>
   <section className={styles.note}><b>How to read this map:</b> The D–R margin compares the registration of Democrats and Republicans whose ballots are reported as cast. It is not a candidate vote count or election forecast. Before live county turnout feeds activate, the map uses county VBM-return and Early Voting files compiled by the Florida Division of Elections. TQV/ElectionLink data automatically takes priority when available. County boundaries are from the U.S. Census Bureau’s January 1, 2026 TIGERweb layer.</section>
 </main>
}
