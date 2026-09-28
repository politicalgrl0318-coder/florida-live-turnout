"use client";

import { geoMercator, geoPath } from "d3-geo";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./map.module.css";

type PartySplit = { dem: number; rep: number; npa: number; other: number };
type TurnoutRow = {
  code: string; name: string; sourceUrl: string; status: "live" | "unavailable";
  registered: number; ballots: number; turnout: number; mail: number; early: number; electionDay: number;
  dem: number; rep: number; npa: number; other: number;
  mailParty: PartySplit; earlyParty: PartySplit; electionDayParty: PartySplit;
  updated: string | null; electionName: string; electionDate: string;
};
type TurnoutPayload = { generatedAt: string; electionName: string; electionDate: string; counties: TurnoutRow[] };
type Split = { rep: number; dem: number; npa: number; other: number; total: number; compiled?: string };
type StateCounty = { code: string; name: string; provided: Split; voted: Split; early: Split };
type StatePayload = { generatedAt: string; compiled: string; counties: StateCounty[] };
type DisplayRow = TurnoutRow & { dataSource: "county" | "state"; stateCompiled?: string };
type PrecinctRow = { precinct: string; location: string; address: string; eligible: number; mail: number; early: number; electionDay: number; ballots: number; turnout: number };
type PrecinctPayload = { county: { code: string; name: string }; updated: string | null; precincts: PrecinctRow[] };
type Metric = "margin" | "mail" | "ballots";
type PrecinctSort = "precinct" | "eligible" | "mail" | "early" | "electionDay" | "ballots" | "turnout";

const number = new Intl.NumberFormat("en-US");
const pct = (value: number) => (Number.isFinite(value) ? `${value.toFixed(2)}%` : "—");
const countyGeo = "/data/florida-counties.geojson";
const browardResults = "https://my.browardvotes.gov/TEDElectionLink/AbsenteeTurnOut/dashboard/view/absturnout-race";
const floridaStats = "https://countyfilesvbm-ev.floridados.gov/VoteByMailEarlyVotingReports/PublicStats";
const normalize = (value: string) => value.toLowerCase().replace(/ county$/, " ").replace(/[^a-z]/g, "").trim();
const emptyParty = (): PartySplit => ({ dem: 0, rep: 0, npa: 0, other: 0 });

function reportUrl(row: TurnoutRow) { return row.code === "BRO" ? browardResults : row.sourceUrl; }
function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(date);
}
function ringArea(ring: number[][]) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return area / 2;
}
function rewindGeometry(geometry: any) {
  if (!geometry) return geometry;
  const rewindPolygon = (rings: number[][][]) => rings.map((ring, index) => {
    const shouldClockwise = index === 0;
    const clockwise = ringArea(ring) < 0;
    return clockwise === shouldClockwise ? ring : [...ring].reverse();
  });
  if (geometry.type === "Polygon") return { ...geometry, coordinates: rewindPolygon(geometry.coordinates) };
  if (geometry.type === "MultiPolygon") return { ...geometry, coordinates: geometry.coordinates.map((polygon: number[][][]) => rewindPolygon(polygon)) };
  return geometry;
}
function fallbackTurnout(row: StateCounty): TurnoutRow {
  return { code: row.code, name: row.name, sourceUrl: floridaStats, status: "unavailable", registered: 0, ballots: 0, turnout: 0, mail: 0, early: 0, electionDay: 0, dem: 0, rep: 0, npa: 0, other: 0, mailParty: emptyParty(), earlyParty: emptyParty(), electionDayParty: emptyParty(), updated: null, electionName: "2026 General Election", electionDate: "11/03/2026" };
}
function mergeRows(current: TurnoutRow[], incoming: TurnoutRow[]) {
  const byCode = new Map(current.map((row) => [row.code, row]));
  incoming.forEach((row) => byCode.set(row.code, row));
  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
}
function mixHex(from: string, to: string, amount: number) {
  const clamped = Math.max(0, Math.min(1, amount));
  const channel = (hex: string, offset: number) => Number.parseInt(hex.slice(offset, offset + 2), 16);
  const component = (start: number, end: number) => Math.round(start + (end - start) * clamped).toString(16).padStart(2, "0");
  return `#${component(channel(from, 1), channel(to, 1))}${component(channel(from, 3), channel(to, 3))}${component(channel(from, 5), channel(to, 5))}`;
}

export default function TurnoutMap() {
  const [rows, setRows] = useState<TurnoutRow[]>([]);
  const [stateRows, setStateRows] = useState<StateCounty[]>([]);
  const [stateCompiled, setStateCompiled] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState("");
  const [metric, setMetric] = useState<Metric>("margin");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [geo, setGeo] = useState<any>(null);
  const [mapError, setMapError] = useState("");
  const [precincts, setPrecincts] = useState<PrecinctRow[]>([]);
  const [precinctLoading, setPrecinctLoading] = useState(false);
  const [precinctError, setPrecinctError] = useState("");
  const [precinctQuery, setPrecinctQuery] = useState("");
  const [precinctSort, setPrecinctSort] = useState<PrecinctSort>("ballots");
  const [precinctAscending, setPrecinctAscending] = useState(false);
  const refreshId = useRef(0);

  async function refresh(force = false) {
    const requestId = ++refreshId.current;
    const refreshToken = force ? Date.now() : null;
    const suffix = refreshToken ? `&refresh=${refreshToken}` : "";
    setRefreshing(true);
    setError("");
    const batchTasks = Array.from({ length: 5 }, async (_, batch) => {
      const response = await fetch(`/api/general-turnout?batch=${batch}${suffix}`);
      const body = await response.json() as TurnoutPayload & { error?: string };
      if (!response.ok) throw new Error(body.error || `County batch ${batch + 1} did not respond.`);
      if (requestId === refreshId.current) setRows((current) => mergeRows(current, body.counties || []));
      return body;
    });
    let stateLoaded = false;
    try {
      const stateUrl = refreshToken ? `/api/general?refresh=${refreshToken}` : "/api/general";
      const stateResponse = await fetch(stateUrl);
      const state = await stateResponse.json() as StatePayload & { error?: string };
      if (!stateResponse.ok) throw new Error(state.error || "The Florida ballot-activity feed did not respond.");
      if (requestId !== refreshId.current) return;
      stateLoaded = true;
      setStateRows(state.counties || []);
      setStateCompiled(state.compiled || "");
      setRows((current) => {
        const existing = new Map(current.map((row) => [row.code, row]));
        return (state.counties || []).map((county) => existing.get(county.code) || fallbackTurnout(county));
      });
      setLoading(false);
    } catch (caught) {
      if (requestId === refreshId.current) setError(caught instanceof Error ? caught.message : "Unable to load official Florida election data.");
    }
    const batches = await Promise.allSettled(batchTasks);
    if (requestId !== refreshId.current) return;
    const successfulBatches = batches.filter((result) => result.status === "fulfilled").length;
    if (successfulBatches < batchTasks.length) setError((current) => current || "Some live county feeds are delayed. State VBM and Early Voting totals are still shown.");
    if (!stateLoaded && successfulBatches === 0) setError("Official election feeds are temporarily unavailable. Please try again.");
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 300000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(countyGeo, { cache: "force-cache", signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("County geography unavailable"); return response.json(); })
      .then((value: any) => setGeo({ ...value, features: (value.features || []).map((feature: any) => ({ ...feature, geometry: rewindGeometry(feature.geometry) })) }))
      .catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setMapError("The county-boundary layer did not load."); });
    return () => controller.abort();
  }, []);

  const live = useMemo(() => rows.filter((row) => row.status === "live"), [rows]);
  const displayRows = useMemo<DisplayRow[]>(() => {
    const stateMap = new Map(stateRows.map((row) => [normalize(row.name), row]));
    return rows.map((row) => {
      const state = stateMap.get(normalize(row.name));
      if (row.status === "live" && row.code === "BRO") {
        const earlyParty = state ? { dem: state.early.dem, rep: state.early.rep, npa: state.early.npa, other: state.early.other } : emptyParty();
        const early = state?.early.total || 0;
        return { ...row, ballots: row.mail + early + row.electionDay, early, dem: row.mailParty.dem + earlyParty.dem + row.electionDayParty.dem, rep: row.mailParty.rep + earlyParty.rep + row.electionDayParty.rep, npa: row.mailParty.npa + earlyParty.npa + row.electionDayParty.npa, other: row.mailParty.other + earlyParty.other + row.electionDayParty.other, earlyParty, dataSource: "county" as const };
      }
      if (row.status === "live") return { ...row, dataSource: "county" as const };
      const ballots = (state?.voted.total || 0) + (state?.early.total || 0);
      if (!state || ballots === 0) return { ...row, dataSource: "state" as const, stateCompiled };
      const dem = state.voted.dem + state.early.dem, rep = state.voted.rep + state.early.rep, npa = state.voted.npa + state.early.npa, other = state.voted.other + state.early.other;
      return { ...row, status: "live" as const, ballots, mail: state.voted.total, early: state.early.total, electionDay: 0, dem, rep, npa, other, mailParty: { dem: state.voted.dem, rep: state.voted.rep, npa: state.voted.npa, other: state.voted.other }, earlyParty: { dem: state.early.dem, rep: state.early.rep, npa: state.early.npa, other: state.early.other }, updated: state.voted.compiled || state.early.compiled || stateCompiled || null, dataSource: "state" as const, stateCompiled };
    });
  }, [rows, stateRows, stateCompiled]);
  const reporting = useMemo(() => displayRows.filter((row) => row.status === "live"), [displayRows]);
  const totals = useMemo(() => reporting.reduce((sum, county) => ({ ballots: sum.ballots + county.ballots, registered: sum.registered + county.registered, dem: sum.dem + county.dem, rep: sum.rep + county.rep, npa: sum.npa + county.npa, other: sum.other + county.other }), { ballots: 0, registered: 0, dem: 0, rep: 0, npa: 0, other: 0 }), [reporting]);
  const partyTotal = totals.dem + totals.rep + totals.npa + totals.other || 1;
  const rowMap = useMemo(() => new Map(displayRows.map((row) => [normalize(row.name), row])), [displayRows]);
  const selected = useMemo(() => displayRows.find((row) => row.code === selectedCode) || null, [displayRows, selectedCode]);
  const maxBallots = useMemo(() => Math.max(1, ...reporting.map((row) => row.ballots)), [reporting]);
  const maxMail = useMemo(() => Math.max(1, ...reporting.map((row) => row.mail)), [reporting]);
  const shapes = useMemo(() => {
    const features = (geo?.features || []) as any[];
    if (!features.length) return [];
    const projection = geoMercator().fitExtent([[24, 24], [876, 576]], { type: "FeatureCollection", features } as any);
    const path = geoPath(projection);
    return features.map((feature) => {
      const name = feature.properties?.BASENAME || feature.properties?.NAME || "Florida county";
      return { name, path: path(feature) || "", row: rowMap.get(normalize(name)) };
    });
  }, [geo, rowMap]);
  function fill(row: DisplayRow | undefined) {
    if (!row || row.status !== "live") return "#e4e2dc";
    if (metric === "margin") { const margin = row.dem - row.rep; return margin > 0 ? "#3b82d0" : margin < 0 ? "#d85b50" : "#9b70d8"; }
    if (metric === "mail") return mixHex("#e8f3ff", "#175ea8", Math.sqrt(row.mail / maxMail));
    return mixHex("#def4f1", "#087f73", Math.sqrt(row.ballots / maxBallots));
  }

  useEffect(() => {
    if (!selectedCode) { setPrecincts([]); setPrecinctError(""); return; }
    const controller = new AbortController();
    setPrecinctLoading(true); setPrecinctError(""); setPrecinctQuery("");
    fetch(`/api/general-turnout?view=precincts&county=${encodeURIComponent(selectedCode)}`, { signal: controller.signal })
      .then(async (response) => { const body = await response.json() as PrecinctPayload & { error?: string }; if (!response.ok) throw new Error(body.error || "Precinct data is not available for this county yet."); return body; })
      .then((body) => setPrecincts(body.precincts || []))
      .catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) { setPrecincts([]); setPrecinctError(caught instanceof Error ? caught.message : "Precinct data is not available for this county yet."); } })
      .finally(() => { if (!controller.signal.aborted) setPrecinctLoading(false); });
    return () => controller.abort();
  }, [selectedCode]);

  const visiblePrecincts = useMemo(() => {
    const needle = precinctQuery.trim().toLowerCase();
    const filtered = precincts.filter((row) => !needle || row.precinct.toLowerCase().includes(needle) || row.location.toLowerCase().includes(needle) || row.address.toLowerCase().includes(needle));
    const value = (row: PrecinctRow) => precinctSort === "precinct" ? row.precinct : row[precinctSort];
    return [...filtered].sort((a, b) => {
      const aValue = value(a), bValue = value(b);
      const difference = typeof aValue === "string" ? aValue.localeCompare(String(bValue), undefined, { numeric: true }) : Number(aValue) - Number(bValue);
      return difference * (precinctAscending ? 1 : -1);
    });
  }, [precincts, precinctQuery, precinctSort, precinctAscending]);
  const precinctTotals = useMemo(() => precincts.reduce((sum, row) => ({ ballots: sum.ballots + row.ballots, eligible: sum.eligible + row.eligible }), { ballots: 0, eligible: 0 }), [precincts]);
  function choosePrecinctSort(next: PrecinctSort) {
    if (next === precinctSort) setPrecinctAscending((current) => !current);
    else { setPrecinctSort(next); setPrecinctAscending(next === "precinct"); }
  }
  const SortButton = ({ field, children }: { field: PrecinctSort; children: React.ReactNode }) => <button className={styles.sort} onClick={() => choosePrecinctSort(field)}>{children}<span>{precinctSort === field ? precinctAscending ? "↑" : "↓" : ""}</span></button>;
  const statewideMargin = totals.dem - totals.rep;

  return <main className={styles.page}>
    <header className={styles.hero}><div><a href="/general" className={styles.back}>← General Election Dashboard</a><span className={styles.kicker}>305 DATA GIRL • FLORIDA BALLOT ACTIVITY</span><h1>Florida 2026 Interactive Turnout Map</h1><p>Click any county to see ballots already cast and its reported precinct activity. State VBM and Early Voting files load first; live TQV/ElectionLink feeds replace them as counties publish.</p></div><button onClick={() => void refresh(true)} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh now"}</button></header>
    {error && <div className={styles.error}>{error}</div>}
    <section className={styles.summary}><article><span>COUNTIES REPORTING CAST BALLOTS</span><b>{reporting.length}/67</b><small>{live.length ? `${live.length} county live feed${live.length === 1 ? "" : "s"} active` : loading ? "Loading official data…" : "State VBM/EV files active"}</small></article><article><span>BALLOTS CAST</span><b>{number.format(totals.ballots)}</b></article><article><span>DEM</span><b>{number.format(totals.dem)} <small>{pct(totals.dem / partyTotal * 100)}</small></b></article><article><span>REP</span><b>{number.format(totals.rep)} <small>{pct(totals.rep / partyTotal * 100)}</small></b></article><article><span>D–R TURNOUT MARGIN</span><b>{statewideMargin >= 0 ? "D" : "R"} +{number.format(Math.abs(statewideMargin))}</b></article></section>
    <section className={styles.mapCard}>
      <div className={styles.mapTop}><div><h2>County ballot activity</h2><p>Party colors represent the registration of voters who have cast ballots — not candidate vote totals.</p></div><div className={styles.controls} aria-label="Map metric"><button className={metric === "margin" ? styles.active : ""} onClick={() => setMetric("margin")}>D–R margin</button><button className={metric === "mail" ? styles.active : ""} onClick={() => setMetric("mail")}>VBM returns</button><button className={metric === "ballots" ? styles.active : ""} onClick={() => setMetric("ballots")}>Ballots cast</button></div></div>
      <div className={styles.mapGrid}><div className={styles.mapWrap}>
        {mapError ? <div className={styles.mapError}>{mapError}</div> : !geo ? <div className={styles.mapLoading}>Loading county boundaries…</div> : <svg viewBox="0 0 900 600" className={styles.map} aria-label="Interactive map of Florida county turnout"><g>{shapes.map((shape) => <path key={shape.name} d={shape.path} fill={fill(shape.row)} stroke="#172033" strokeWidth="1.25" tabIndex={0} role="button" aria-label={`${shape.name} turnout details`} onClick={() => setSelectedCode(shape.row?.code || null)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedCode(shape.row?.code || null); } }}/>)}</g></svg>}
        <div className={styles.legend}>{metric === "margin" ? <><span><i className={styles.blue}/>DEM turnout lead</span><span><i className={styles.red}/>REP turnout lead</span><span><i className={styles.purple}/>Tie</span></> : <span>Dark = higher {metric === "mail" ? "VBM returns" : "ballot volume"}</span>}<span><i className={styles.gray}/>No cast ballots reported yet</span></div>
      </div><aside className={styles.detail}>{selected ? <><span className={styles.detailLabel}>SELECTED COUNTY</span><h3>{selected.name}</h3>{selected.status === "live" ? <><div className={styles.big}>{number.format(selected.ballots)}<small> ballots cast</small></div><dl>{selected.dataSource === "county" && <div><dt>Turnout</dt><dd>{pct(selected.turnout)}</dd></div>}<div><dt>VBM returned</dt><dd>{number.format(selected.mail)}</dd></div><div><dt>Early vote</dt><dd>{number.format(selected.early)}</dd></div>{selected.dataSource === "county" && <div><dt>Election Day</dt><dd>{number.format(selected.electionDay)}</dd></div>}<div><dt>DEM</dt><dd>{number.format(selected.dem)}</dd></div><div><dt>REP</dt><dd>{number.format(selected.rep)}</dd></div><div><dt>NPA</dt><dd>{number.format(selected.npa)}</dd></div><div><dt>D–R margin</dt><dd>{selected.dem >= selected.rep ? "D" : "R"} +{number.format(Math.abs(selected.dem - selected.rep))}</dd></div></dl><small>Source: {selected.dataSource === "county" ? "live county turnout feed" : "Florida Division of Elections county VBM/EV file"} • Update: {formatTime(selected.updated)}</small><a href={selected.dataSource === "county" ? reportUrl(selected) : floridaStats} target="_blank" rel="noreferrer">Open official source ↗</a><a className={styles.precinctJump} href="#precinct-data">View precinct data ↓</a></> : <><p>No returned VBM or Early Voting ballots are currently reported for this county, and its live county turnout feed has not activated yet.</p><a href={floridaStats} target="_blank" rel="noreferrer">Check Florida reporting ↗</a><a className={styles.precinctJump} href="#precinct-data">Check precinct feed ↓</a></>}</> : <><span className={styles.detailLabel}>EXPLORE THE MAP</span><h3>Tap a county</h3><p>Select any county for its current VBM returns, Early Voting activity, party-registration breakdown and precinct-level turnout.</p></>}</aside></div>
    </section>
    {selected && <section className={styles.precinctCard} id="precinct-data"><div className={styles.precinctHead}><div><span>PRECINCT LEVEL</span><h2>{selected.name} precinct activity</h2><p>Reported ballots by precinct from the county’s live {selected.code === "BRO" ? "ElectionLink" : "TQV"} feed. Only precincts with activity currently appear.</p></div><input value={precinctQuery} onChange={(event) => setPrecinctQuery(event.target.value)} placeholder="Search precinct or location…" aria-label="Search precincts" /></div>{precinctLoading ? <div className={styles.precinctState}>Loading {selected.name} precincts…</div> : precinctError ? <div className={styles.precinctState}><b>Precinct feed:</b> {precinctError}</div> : <><div className={styles.precinctSummary}><article><span>PRECINCTS REPORTING ACTIVITY</span><b>{number.format(precincts.length)}</b></article><article><span>BALLOTS IN PRECINCT FEED</span><b>{number.format(precinctTotals.ballots)}</b></article><article><span>ELIGIBLE IN REPORTED PRECINCTS</span><b>{number.format(precinctTotals.eligible)}</b></article></div><div className={styles.precinctTableWrap}><table><thead><tr><th><SortButton field="precinct">Precinct</SortButton></th><th>Polling location</th><th><SortButton field="eligible">Registered</SortButton></th><th><SortButton field="mail">VBM</SortButton></th><th><SortButton field="early">Early vote</SortButton></th><th><SortButton field="electionDay">Election Day</SortButton></th><th><SortButton field="ballots">Ballots cast</SortButton></th><th><SortButton field="turnout">Turnout</SortButton></th></tr></thead><tbody>{visiblePrecincts.map((row) => <tr key={row.precinct}><td><b>{row.precinct}</b></td><td><b>{row.location || "—"}</b><span>{row.address}</span></td><td>{number.format(row.eligible)}</td><td>{number.format(row.mail)}</td><td>{number.format(row.early)}</td><td>{number.format(row.electionDay)}</td><td><b>{number.format(row.ballots)}</b></td><td>{pct(row.turnout)}</td></tr>)}</tbody></table></div>{!visiblePrecincts.length && <div className={styles.precinctState}>No precincts match that search.</div>}</>}</section>}
    <section className={styles.note}><b>How to read this map:</b> The D–R margin compares the registration of Democrats and Republicans whose ballots are reported as cast. It is not a candidate vote count or election forecast. State files load first so the map can render quickly; county TQV/ElectionLink data then replaces the fallback as available. Precinct totals are reported by ballot method and do not include a party split in the current TQV precinct feed. County boundaries are from the U.S. Census Bureau TIGERweb layer.</section>
  </main>;
}
