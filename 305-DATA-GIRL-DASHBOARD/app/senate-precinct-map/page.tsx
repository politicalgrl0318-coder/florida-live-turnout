"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { primaryCounties } from "../primary-map/data";

type PrecinctRow = {
  county: string;
  precinct: string;
  nixon: number;
  vindman: number;
};

type CountyResult = {
  county: string;
  nixon: number;
  vindman: number;
  total: number;
  precincts: PrecinctRow[];
};

const fmt = new Intl.NumberFormat("en-US");

function parseCsv(text: string): PrecinctRow[] {
  const lines = text.trim().split(/\r?\n/).slice(1);
  return lines.map((line) => {
    const cells = line.split(",");
    return {
      county: cells[1],
      precinct: cells[2],
      nixon: Number(cells[3]) || 0,
      vindman: Number(cells[4]) || 0,
    };
  });
}

function colorFor(result?: CountyResult) {
  if (!result || !result.total) return "#d9dee5";
  const share = result.nixon / result.total;
  const strength = Math.min(1, Math.abs(share - 0.5) / 0.3);
  if (share >= 0.5) {
    const light = Math.round(72 - strength * 34);
    return `hsl(210 78% ${light}%)`;
  }
  const light = Math.round(72 - strength * 34);
  return `hsl(27 86% ${light}%)`;
}

export default function SenatePrecinctResultsMap() {
  const [rows, setRows] = useState<PrecinctRow[]>([]);
  const [selectedCounty, setSelectedCounty] = useState("Miami-Dade");
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch("/data/nixon-vindman-precincts-partial.csv")
      .then((response) => {
        if (!response.ok) throw new Error("Dataset unavailable");
        return response.text();
      })
      .then((text) => setRows(parseCsv(text)))
      .catch(() => setLoadError(true));
  }, []);

  const countyResults = useMemo(() => {
    const map = new Map<string, CountyResult>();
    rows.forEach((row) => {
      const current = map.get(row.county) || {
        county: row.county,
        nixon: 0,
        vindman: 0,
        total: 0,
        precincts: [],
      };
      current.nixon += row.nixon;
      current.vindman += row.vindman;
      current.total += row.nixon + row.vindman;
      current.precincts.push(row);
      map.set(row.county, current);
    });
    return map;
  }, [rows]);

  const reported = useMemo(
    () => [...countyResults.values()].filter((county) => county.total > 0),
    [countyResults],
  );

  const availableTotals = useMemo(
    () => reported.reduce(
      (sum, county) => ({
        nixon: sum.nixon + county.nixon,
        vindman: sum.vindman + county.vindman,
        total: sum.total + county.total,
      }),
      { nixon: 0, vindman: 0, total: 0 },
    ),
    [reported],
  );

  const selected = countyResults.get(selectedCounty);
  const selectedHasVotes = Boolean(selected?.total);
  const selectedShare = selectedHasVotes ? (selected!.nixon / selected!.total) * 100 : 0;
  const selectedWinner = selectedHasVotes ? (selected!.nixon >= selected!.vindman ? "Angie Nixon" : "Alex Vindman") : "No usable results";
  const selectedMargin = selectedHasVotes ? Math.abs(selected!.nixon - selected!.vindman) : 0;

  const precincts = useMemo(() => {
    if (!selected) return [];
    const needle = query.trim().toLowerCase();
    return selected.precincts
      .filter((row) => !needle || row.precinct.toLowerCase().includes(needle))
      .filter((row) => row.nixon + row.vindman > 0)
      .sort((a, b) => (b.nixon + b.vindman) - (a.nixon + a.vindman));
  }, [selected, query]);

  return (
    <main className="results-page">
      <style>{`
        .results-page{max-width:1180px;margin:0 auto;padding:42px 22px 72px;font-family:var(--font-geist-sans)}
        .results-hero{padding:34px;border-radius:28px;background:linear-gradient(135deg,#071d36,#123b63);color:#fff}
        .stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:24px 0}
        .stat-card,.panel{padding:24px;border:1px solid #dce5ee;border-radius:20px;background:#fff}
        .map-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(270px,1fr);gap:26px;align-items:center}
        .fl-map{width:100%;height:auto;max-height:650px}
        .county-path{cursor:pointer;transition:opacity .15s ease}
        .county-path:hover{opacity:.76}
        .detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .result-table{width:100%;border-collapse:collapse}
        .result-table th,.result-table td{padding:11px 9px;border-bottom:1px solid #e4e9ef;text-align:right}
        .result-table th:first-child,.result-table td:first-child{text-align:left}
        .result-table th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#536577}
        @media(max-width:760px){.stat-grid,.map-grid{grid-template-columns:1fr}.results-hero{padding:26px}.panel{padding:18px}.result-table{font-size:13px}.result-table th,.result-table td{padding:9px 5px}}
      `}</style>

      <header className="results-hero">
        <p style={{letterSpacing:".14em",fontWeight:800,fontSize:12,margin:0}}>305 DATA GIRL • 2026 PRIMARY</p>
        <h1 style={{fontSize:"clamp(34px,6vw,64px)",lineHeight:1.02,margin:"14px 0"}}>Nixon vs. Vindman<br/>results explorer</h1>
        <p style={{maxWidth:800,fontSize:18,lineHeight:1.55,opacity:.92}}>
          Select a county to see the reported vote, candidate margin and its highest-volume precincts.
          Blue counties favored Angie Nixon; orange counties favored Alex Vindman.
        </p>
        <Link href="/" style={{color:"#fff",fontWeight:800}}>← Return to dashboard</Link>
      </header>

      <section className="stat-grid">
        <article className="stat-card">
          <span>Counties with usable results</span>
          <strong style={{display:"block",fontSize:38,marginTop:8}}>{rows.length ? reported.length : "—"} of 67</strong>
        </article>
        <article className="stat-card">
          <span>Precinct records loaded</span>
          <strong style={{display:"block",fontSize:38,marginTop:8}}>{rows.length ? fmt.format(rows.length) : "—"}</strong>
        </article>
        <article className="stat-card">
          <span>Votes represented here</span>
          <strong style={{display:"block",fontSize:38,marginTop:8}}>{rows.length ? fmt.format(availableTotals.total) : "—"}</strong>
        </article>
      </section>

      {loadError && (
        <section className="panel" style={{background:"#fff0f0",borderColor:"#efb3b3",marginBottom:20}}>
          The results file did not load. This page is not displaying zero votes; the source file is temporarily unavailable.
        </section>
      )}

      <section className="panel">
        <div style={{display:"flex",gap:18,justifyContent:"space-between",alignItems:"end",flexWrap:"wrap",marginBottom:14}}>
          <div>
            <h2 style={{fontSize:28,margin:"0 0 7px"}}>County results map</h2>
            <p style={{margin:0,color:"#536577"}}>Color intensity reflects the winner’s margin. Gray means unavailable—not tied.</p>
          </div>
          <div style={{display:"flex",gap:14,fontWeight:750,fontSize:14}}>
            <span><i style={{display:"inline-block",width:12,height:12,borderRadius:3,background:"#2878c7",marginRight:6}}/>Nixon</span>
            <span><i style={{display:"inline-block",width:12,height:12,borderRadius:3,background:"#e4832e",marginRight:6}}/>Vindman</span>
            <span><i style={{display:"inline-block",width:12,height:12,borderRadius:3,background:"#d9dee5",marginRight:6}}/>Unavailable</span>
          </div>
        </div>

        <div className="map-grid">
          <svg className="fl-map" viewBox="0 0 860 650" role="img" aria-label="Florida Nixon versus Vindman results by county">
            {primaryCounties.map((county) => {
              const result = countyResults.get(county.name);
              const selectedPath = county.name === selectedCounty;
              const winner = result?.total ? (result.nixon >= result.vindman ? "Nixon" : "Vindman") : "unavailable";
              return (
                <path
                  key={county.id}
                  d={county.path}
                  className="county-path"
                  fill={colorFor(result)}
                  stroke={selectedPath ? "#071d36" : "#ffffff"}
                  strokeWidth={selectedPath ? 4 : 1.25}
                  onClick={() => { setSelectedCounty(county.name); setQuery(""); }}
                  onMouseEnter={() => setSelectedCounty(county.name)}
                  onFocus={() => setSelectedCounty(county.name)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${county.name} County: ${winner}`}
                />
              );
            })}
          </svg>

          <aside style={{padding:22,borderRadius:18,background:selectedHasVotes ? (selectedShare >= 50 ? "#eaf3fb" : "#fff1e5") : "#f2f4f7",border:"1px solid #d8e0e8"}}>
            <p style={{fontSize:12,fontWeight:850,letterSpacing:".1em",textTransform:"uppercase",margin:"0 0 8px",color:"#536577"}}>Selected county</p>
            <h3 style={{fontSize:32,margin:"0 0 8px"}}>{selectedCounty}</h3>
            {selectedHasVotes ? (
              <>
                <p style={{fontSize:21,fontWeight:850,margin:"0 0 16px"}}>{selectedWinner} by {fmt.format(selectedMargin)}</p>
                <div className="detail-grid">
                  <div><span style={{color:"#536577"}}>Nixon</span><strong style={{display:"block",fontSize:22}}>{fmt.format(selected!.nixon)}</strong><small>{selectedShare.toFixed(1)}%</small></div>
                  <div><span style={{color:"#536577"}}>Vindman</span><strong style={{display:"block",fontSize:22}}>{fmt.format(selected!.vindman)}</strong><small>{(100-selectedShare).toFixed(1)}%</small></div>
                </div>
              </>
            ) : (
              <p style={{lineHeight:1.55,margin:0}}>No usable candidate totals are loaded for this county. It is not being treated as a tie or as zero turnout.</p>
            )}
          </aside>
        </div>
      </section>

      <section className="panel" style={{marginTop:20}}>
        <div style={{display:"flex",gap:14,justifyContent:"space-between",alignItems:"end",flexWrap:"wrap"}}>
          <div>
            <h2 style={{fontSize:28,margin:"0 0 7px"}}>{selectedCounty} precinct results</h2>
            <p style={{margin:0,color:"#536577"}}>{selectedHasVotes ? `${fmt.format(precincts.length)} reporting precinct records, ranked by combined vote` : "No precinct results available"}</p>
          </div>
          <input aria-label="Search precincts" placeholder="Search precinct…" value={query} onChange={(event)=>setQuery(event.target.value)}
            style={{padding:"12px 14px",border:"1px solid #b8c5d1",borderRadius:12,fontSize:16}}/>
        </div>

        {selectedHasVotes && (
          <div style={{overflowX:"auto",marginTop:18}}>
            <table className="result-table">
              <thead><tr><th>Precinct</th><th>Nixon</th><th>Vindman</th><th>Winner</th><th>Margin</th></tr></thead>
              <tbody>
                {precincts.map((row) => {
                  const total = row.nixon + row.vindman;
                  const nixonWon = row.nixon >= row.vindman;
                  return (
                    <tr key={row.precinct}>
                      <td>{row.precinct}</td>
                      <td>{fmt.format(row.nixon)} <small>({(100*row.nixon/total).toFixed(1)}%)</small></td>
                      <td>{fmt.format(row.vindman)} <small>({(100*row.vindman/total).toFixed(1)}%)</small></td>
                      <td style={{fontWeight:800,color:nixonWon ? "#1d66ad" : "#b65b10"}}>{nixonWon ? "Nixon" : "Vindman"}</td>
                      <td>{fmt.format(Math.abs(row.nixon-row.vindman))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{padding:26,marginTop:20,borderRadius:22,background:"#fff4e5",border:"1px solid #ffd59b"}}>
        <h2 style={{marginTop:0}}>Read this map correctly</h2>
        <p style={{lineHeight:1.65}}>
          This is a partial results explorer, not a statewide final precinct map. It contains {reported.length || 0} counties with usable Nixon–Vindman totals from the normalized county files currently collected. Additional county sources remain pending, and Bay and Pasco are present in the source export but contain no usable candidate totals. Congressional-district assignments and split-precinct geometry are still being validated.
        </p>
        <p style={{marginBottom:0}}>Missing data are never counted as zero. Results remain unofficial until canvassing and certification are complete. Sources: county Supervisors of Elections and Florida Election Watch.</p>
      </section>
    </main>
  );
}
