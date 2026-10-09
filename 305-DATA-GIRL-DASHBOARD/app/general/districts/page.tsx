"use client";

import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import styles from "./districts.module.css";

type Chamber = "congressional" | "house" | "senate";
type Metric = "margin" | "returned" | "rate" | "sent";
type DistrictRow = {
  district:string;
  demSent:number;repSent:number;npaSent:number;otherSent:number;
  demRate:number;repRate:number;npaRate:number;otherRate:number;
  demRateRank:number;repRateRank:number;npaRateRank:number;otherRateRank:number;
  changeReturned:number|null;changeRate:number|null;changeMargin:number|null;npaShare:number;
  sent:number;
  returned:number;
  demReturned:number;
  repReturned:number;
  npaReturned:number;
  otherReturned:number;
  returnRate:number;
  drReturnMargin:number;
  drSentMargin:number;
};
type DistrictPayload = {
  generatedAt:string;
  snapshotCompiled:string;baselineDate:string;sourcePackage:string;excludedCongressional:{sent:number;returned:number};
  election:string;
  electionDate:string;
  electionNumber:string;
  dataThrough:string;
  complete:boolean;
  coverage:{countiesLoaded:number;countiesExpected:number;note:string};
  statewide:{provided:number;returned:number;sent:number;demReturned:number;repReturned:number;npaReturned:number;otherReturned:number};
  files:Record<Chamber,string[]>;
  definitions:{provided:string;returned:string;sent:string;returnRate:string};
};
type GeoFeature = {
  type:"Feature";
  properties:Record<string,string|number|null>;
  geometry:{type:"Polygon"|"MultiPolygon";coordinates:unknown};
};
type GeoCollection = {type:"FeatureCollection";features:GeoFeature[]};
type SortKey = "district"|"sent"|"returned"|"rate"|"dem"|"rep"|"npa"|"margin";

const number = new Intl.NumberFormat("en-US");
const pct = (v:number) => Number.isFinite(v) ? v.toFixed(2) + "%" : "—";
const configs:Record<Chamber,{label:string;short:string;count:number;sourceUrl:string}> = {
  congressional:{label:"Congressional districts",short:"CD",count:28,sourceUrl:"https://www.flsenate.gov/Session/Redistricting/Congressional"},
  house:{label:"Florida House districts",short:"HD",count:120,sourceUrl:"https://www.flsenate.gov/Session/Redistricting/2022"},
  senate:{label:"Florida Senate districts",short:"SD",count:40,sourceUrl:"https://www.flsenate.gov/Session/Redistricting/2022"},
};

function featureDistrict(feature:GeoFeature){
  const p=feature.properties||{};
  const raw=p.DISTRICT ?? p.district ?? p.DISTRICTID ?? p.House_District_Number ?? p.Senate_District_Number ?? p.SHORTNAME ?? p.LONGNAME ?? "";
  const match=String(raw).match(/\d+/);
  return match ? String(Number(match[0])) : "";
}
function marginLabel(row?:DistrictRow){
  if(!row || !row.returned) return "—";
  if(row.drReturnMargin===0) return "Even";
  return (row.drReturnMargin>0?"D":"R") + " +" + number.format(Math.abs(row.drReturnMargin));
}
function metricValue(row:DistrictRow, metric:Metric){
  if(metric==="margin") return Math.abs(row.drReturnMargin);
  if(metric==="returned") return row.returned;
  if(metric==="rate") return row.returnRate;
  return row.sent;
}
function metricLabel(metric:Metric){
  if(metric==="margin") return "D–R return margin";
  if(metric==="returned") return "VBM returned";
  if(metric==="rate") return "VBM return rate";
  return "VBM sent / provided";
}
function fillFor(row:DistrictRow|undefined, metric:Metric, maxValue:number){
  if(!row) return "#d9dee5";
  if(metric==="margin"){
    if(!row.returned || row.drReturnMargin===0) return "#d9dee5";
    const strength=Math.min(1,Math.abs(row.drReturnMargin)/Math.max(1,row.returned)*2.4);
    const light=Math.round(78-strength*38);
    return row.drReturnMargin>0 ? "hsl(211 69% " + light + "%)" : "hsl(4 65% " + light + "%)";
  }
  const raw=metricValue(row,metric);
  const strength=maxValue?Math.min(1,raw/maxValue):0;
  const light=Math.round(89-strength*48);
  return "hsl(177 48% " + light + "%)";
}

export default function DistrictsPage(){
  const[chamber,setChamber]=useState<Chamber>("congressional");
  const[metric,setMetric]=useState<Metric>("margin");
  const[data,setData]=useState<DistrictPayload|null>(null);
  const[rows,setRows]=useState<DistrictRow[]>([]);
  const[boundaries,setBoundaries]=useState<GeoCollection|null>(null);
  const[dataError,setDataError]=useState("");
  const[mapError,setMapError]=useState("");
  const[rowsLoading,setRowsLoading]=useState(true);
  const[selected,setSelected]=useState("");
  const[query,setQuery]=useState("");
  const[sort,setSort]=useState<SortKey>("returned");
  const[ascending,setAscending]=useState(false);

  useEffect(()=>{
    fetch("/data/general-districts.json",{cache:"no-store"})
      .then(r=>{if(!r.ok)throw new Error("District metadata unavailable");return r.json()})
      .then((j:DistrictPayload)=>setData(j))
      .catch(e=>setDataError(e instanceof Error?e.message:"District metadata unavailable"));
  },[]);

  useEffect(()=>{
    if(!data)return;
    setRowsLoading(true);setDataError("");
    Promise.all((data.files[chamber]||[]).map(file=>fetch(file,{cache:"no-store"}).then(r=>{
      if(!r.ok)throw new Error("District data file unavailable");
      return r.json() as Promise<DistrictRow[]>;
    })))
      .then(parts=>setRows(parts.flat().sort((a,b)=>Number(a.district)-Number(b.district))))
      .catch(e=>setDataError(e instanceof Error?e.message:"District data unavailable"))
      .finally(()=>setRowsLoading(false));
  },[data,chamber]);

  useEffect(()=>{
    setBoundaries(null);setMapError("");
    fetch("/api/district-boundaries?chamber="+chamber,{cache:"force-cache"})
      .then(r=>{if(!r.ok)throw new Error("Official boundary service did not respond");return r.json()})
      .then((j:GeoCollection)=>{
        if(!j?.features?.length)throw new Error("No district geometry returned");
        setBoundaries(j);
      })
      .catch(e=>setMapError(e instanceof Error?e.message:"Boundary map unavailable"));
  },[chamber]);

  const rowMap=useMemo(()=>new Map(rows.map(r=>[String(Number(r.district)),r])),[rows]);
  useEffect(()=>{
    if(rows.length && !rowMap.has(String(Number(selected)))) setSelected(rows[0].district);
  },[rows,rowMap,selected]);

  const filtered=useMemo(()=>{
    const needle=query.trim().toLowerCase();
    const list=rows.filter(r=>!needle||(configs[chamber].short+"-"+r.district).toLowerCase().includes(needle)||r.district.includes(needle));
    return [...list].sort((a,b)=>{
      const value=(r:DistrictRow)=>sort==="district"?Number(r.district):sort==="sent"?r.sent:sort==="returned"?r.returned:sort==="rate"?r.returnRate:sort==="dem"?r.demReturned:sort==="rep"?r.repReturned:sort==="npa"?r.npaReturned:r.drReturnMargin;
      return (value(a)-value(b))*(ascending?1:-1);
    });
  },[rows,query,sort,ascending,chamber]);

  const maxValue=Math.max(1,...rows.map(r=>metricValue(r,metric)));
  const selectedRow=selected?rowMap.get(String(Number(selected))):undefined;
  const config=configs[chamber];
  const mapPaths=useMemo(()=>{
    if(!boundaries)return [];
    const projection=geoMercator().fitSize([820,610],boundaries as never);
    const path=geoPath(projection);
    return boundaries.features.map(feature=>({
      feature,
      district:featureDistrict(feature),
      d:path(feature as never)||"",
      centroid:path.centroid(feature as never),
    }));
  },[boundaries]);

  const statewide=data?.statewide;
  function chooseSort(next:SortKey){
    if(sort===next)setAscending(!ascending);
    else{setSort(next);setAscending(next==="district")}
  }
  const SortButton=({k,children}:{k:SortKey;children:React.ReactNode})=><button className={styles.sort} onClick={()=>chooseSort(k)}>{children}<span>{sort===k?(ascending?"↑":"↓"):""}</span></button>;

  return <main className={styles.page}>
    <header className={styles.hero}>
      <div className={styles.eyebrow}><i/> DISTRICT RESULTS + MAPS</div>
      <h1>Florida 2026 district turnout</h1>
      <p>Vote-by-mail activity by congressional, Florida House and Florida Senate district, built from the verified October 9 voter-level VBM archive, including Monroe.</p>
      <div className={styles.meta}><span>Election 49894</span><b>•</b><span>General Election: Nov. 3</span><b>•</b><span>Voter file: {data?.snapshotCompiled||"loading…"} • activity through {data?.dataThrough||"loading…"}</span><b>•</b><span>{data?data.coverage.countiesLoaded+"/67 counties loaded":"loading…"}</span></div>
    </header>

    <section className={styles.content}>
      {dataError&&<div className={styles.error}><b>District feed issue:</b> {dataError}</div>}
      {data&&!data.complete&&<div className={styles.warning}><strong>COUNTY REPORTING GAP — {data.coverage.countiesLoaded}/{data.coverage.countiesExpected} counties represented</strong><p>{data.coverage.note}</p></div>}

      <div className={styles.controls}>
        <div className={styles.segment} aria-label="Choose district type">
          {(Object.keys(configs) as Chamber[]).map(k=><button key={k} className={chamber===k?styles.active:""} onClick={()=>setChamber(k)}>{configs[k].label}</button>)}
        </div>
        <label>Map measure<select value={metric} onChange={e=>setMetric(e.target.value as Metric)}><option value="margin">D–R return margin</option><option value="returned">VBM returned</option><option value="rate">VBM return rate</option><option value="sent">VBM sent / provided</option></select></label>
      </div>

      <div className={styles.cards}>
        <article><span>VBM sent / provided</span><strong>{statewide?number.format(statewide.sent):"—"}</strong><small>{statewide?number.format(statewide.provided)+" still outstanding":"Statewide package"}</small></article>
        <article><span>VBM returned</span><strong>{statewide?number.format(statewide.returned):"—"}</strong><small>{statewide&&statewide.sent?pct(statewide.returned/statewide.sent*100):"—"} statewide return rate</small></article>
        <article><span>DEM returns</span><strong className={styles.dem}>{statewide?number.format(statewide.demReturned):"—"}</strong><small>{statewide&&statewide.returned?pct(statewide.demReturned/statewide.returned*100):"—"} of statewide returns</small></article>
        <article><span>REP returns</span><strong className={styles.rep}>{statewide?number.format(statewide.repReturned):"—"}</strong><small>{statewide&&statewide.returned?pct(statewide.repReturned/statewide.returned*100):"—"} of statewide returns</small></article>
      </div>

      <section className={styles.method}><h2>Snapshot and reporting status</h2><p>District data uses {data?.sourcePackage||"the voter-level package"}. Statewide/county live data on the Dashboard is separately timestamped. Daily district changes compare {data?.baselineDate||"the prior package"}.</p><p>{data?number.format(data.excludedCongressional.returned):"—"} returned ballots and {data?number.format(data.excludedCongressional.sent):"—"} P + V records have no valid congressional assignment and remain in statewide totals.</p><p>Zero or low reported returns can reflect processing and reporting timing. 66 of 67 counties are represented. Monroe is included; Calhoun is absent, with no prior records substituted. Affected district totals and rankings are provisional. Treat these figures as reported mail-return activity, not a turnout forecast.</p></section>
      <section className={styles.mapCard}>
        <div className={styles.mapHead}><div><h2>{config.label}</h2><p>{metricLabel(metric)} • district totals come from the county voter-level files.</p></div><a href={config.sourceUrl} target="_blank" rel="noreferrer">Official district boundaries ↗</a></div>
        {!mapError&&<div className={styles.mapGrid}>
          <div className={styles.mapWrap}>
            {(!boundaries||rowsLoading)&&<div className={styles.loading}>Loading statewide district data…</div>}
            {boundaries&&!rowsLoading&&<svg viewBox="0 0 820 610" role="img" aria-label={config.label+" vote-by-mail map"}>
              {mapPaths.map(p=>{const row=rowMap.get(p.district);const active=p.district===selected;return <g key={p.district||p.d}>
                <path d={p.d} fill={fillFor(row,metric,maxValue)} stroke={active?"#101a2b":"#ffffff"} strokeWidth={active?3:1.1} tabIndex={0} role="button" onMouseEnter={()=>setSelected(p.district)} onFocus={()=>setSelected(p.district)} onClick={()=>setSelected(p.district)} aria-label={(config.short+"-"+p.district)+": "+(row?marginLabel(row):"no assigned records")}/>
                {chamber!=="house"&&p.centroid.every(Number.isFinite)&&<text x={p.centroid[0]} y={p.centroid[1]}>{p.district}</text>}
              </g>})}
            </svg>}
          </div>
          <aside className={styles.detail}>
            <span>Selected district</span><h3>{selected?config.short+"-"+selected:"—"}</h3>
            {selectedRow?<><strong className={selectedRow.drReturnMargin>=0?styles.dem:styles.rep}>{marginLabel(selectedRow)}</strong><div className={styles.detailGrid}>
              <div><small>VBM sent</small><b>{number.format(selectedRow.sent)}</b></div><div><small>Returned</small><b>{number.format(selectedRow.returned)}</b></div><div><small>Return rate</small><b>{pct(selectedRow.returnRate)}</b></div><div><small>DEM</small><b>{number.format(selectedRow.demReturned)}</b></div><div><small>REP</small><b>{number.format(selectedRow.repReturned)}</b></div><div><small>NPA</small><b>{number.format(selectedRow.npaReturned)}</b></div><div><small>Daily return change</small><b>{selectedRow.changeReturned===null?"Unavailable":`${selectedRow.changeReturned>=0?"+":""}${number.format(selectedRow.changeReturned)}`}</b></div>
            </div></>:<p>No usable district assignment is loaded for this boundary.</p>}
          </aside>
        </div>}
        <div className={styles.legend}><span><i className={styles.blue}/> Democratic return margin</span><span><i className={styles.red}/> Republican return margin</span><span><i className={styles.gray}/> Even / no assigned records</span></div>
      </section>

      <section className={styles.tableCard}>
        <div className={styles.tableHead}><div><h2>{config.label} table</h2><p>{rowsLoading?"Loading statewide district records…":"All "+config.count+" districts • sortable VBM activity • party rate ranks compare the same party within this chamber"}</p></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={"Search "+config.short+"…"}/></div>
        <div className={styles.tableWrap}><table><thead><tr><th><SortButton k="district">District</SortButton></th><th><SortButton k="sent">VBM sent</SortButton></th><th><SortButton k="returned">Returned</SortButton></th><th><SortButton k="rate">Return rate</SortButton></th><th><SortButton k="dem">DEM</SortButton></th><th><SortButton k="rep">REP</SortButton></th><th><SortButton k="npa">NPA</SortButton></th><th>Other</th><th><SortButton k="margin">D–R margin</SortButton></th><th>Daily returns</th><th>DEM rate</th><th>REP rate</th><th>NPA rate</th><th>Other rate</th></tr></thead><tbody>{filtered.map(r=><tr key={r.district} onClick={()=>setSelected(r.district)}><td><b>{config.short}-{r.district}</b></td><td>{number.format(r.sent)}</td><td>{number.format(r.returned)}</td><td>{pct(r.returnRate)}</td><td className={styles.dem}>{number.format(r.demReturned)}</td><td className={styles.rep}>{number.format(r.repReturned)}</td><td>{number.format(r.npaReturned)}</td><td>{number.format(r.otherReturned)}</td><td className={r.drReturnMargin>=0?styles.dem:styles.rep}>{marginLabel(r)}</td><td>{r.changeReturned===null?"Unavailable":`${r.changeReturned>=0?"+":""}${number.format(r.changeReturned)}`}</td><td>{pct(r.demRate)} <small>#{r.demRateRank}</small></td><td>{pct(r.repRate)} <small>#{r.repRateRank}</small></td><td>{pct(r.npaRate)} <small>#{r.npaRateRank}</small></td><td>{pct(r.otherRate)} <small>#{r.otherRateRank}</small></td></tr>)}</tbody></table></div>
      </section>

      <section className={styles.method}>
        <h2>Method and sources</h2>
        <p><b>Provided / outstanding</b> uses voter-file <code>VoteByMail</code> status <b>P</b>. <b>Returned / voted VBM</b> uses status <b>V</b>. <b>VBM sent / provided</b> is P + V, and return rate is V ÷ (P + V). This mirrors the state’s public “Provided (Not Yet Returned)” and “Voted Vote-by-Mail” categories more closely than relying on date fields alone.</p>
        <p>District assignments come directly from each county VBM record. Records with a blank or zero district assignment are excluded from that district table but remain included in the statewide cards. Map geometry comes from Florida’s official redistricting boundary services.</p>
        <div><a href="https://countyfilesvbm-ev.floridados.gov/VoteByMailEarlyVotingReports/PublicStats" target="_blank" rel="noreferrer">Florida Division of Elections VBM statistics ↗</a><a href={config.sourceUrl} target="_blank" rel="noreferrer">Florida district maps ↗</a></div>
      </section>
    </section>
  </main>;
}
