"use client";

import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath, geoArea } from "d3-geo";
import data from "./data.json";
import styles from "./shift.module.css";

const chambers = {
  congressional: "U.S. House",
  house: "Florida House",
  senate: "Florida Senate",
};

const baselines = {
  president: "2024 presidential",
  prior: "Previous general election for the seat",
  midterm: "2022 midterm",
};

type Chamber = keyof typeof chambers;
type Baseline = keyof typeof baselines;
type District = {
  current: number[] | null;
  president: number[];
  prior: number[] | null;
  midterm: number[] | null;
  priorYear: number;
  status: string;
  returnsSource?: string;
};
type Feature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, { DISTRICT: number }>;
type Boundaries = GeoJSON.FeatureCollection<Feature["geometry"], Feature["properties"]>;

const votes = new Intl.NumberFormat("en-US");

function margin(pair: number[] | null) {
  return pair ? 100 * (pair[0] - pair[1]) / (pair[0] + pair[1]) : null;
}

function label(value: number | null, suffix = "") {
  if (value === null) return "Unavailable";
  if (Math.abs(value) < 0.005) return "Even";
  return (value > 0 ? "D+" : "R+") + Math.abs(value).toFixed(2) + suffix;
}

function shift(row: District, baseline: Baseline) {
  const current = margin(row.current);
  const previous = margin(row[baseline]);
  return row.status || current === null || previous === null ? null : current - previous;
}

function color(value: number | null) {
  if (value === null) return "#50546c";
  if (Math.abs(value) < 0.005) return "#f0e9f8";
  const [light, dark] = value > 0
    ? [[186, 215, 255], [38, 59, 89]]
    : [[255, 192, 206], [81, 46, 64]];
  const strength = Math.min(Math.abs(value) / 25, 1) * 0.75;
  const channels = light.map((channel, index) => Math.round(channel + (dark[index] - channel) * strength));
  return `rgb(${channels.join(", ")})`;
}

function normalize(feature: Feature): Feature {
  // GeoJSON exteriors from ArcGIS may have the opposite winding to D3's spherical polygons.
  if (geoArea(feature) <= 2 * Math.PI) return feature;
  const geometry = feature.geometry;
  const reverse = (polygon: GeoJSON.Position[][]) => polygon.map(ring => [...ring].reverse());
  return {
    ...feature,
    geometry: geometry.type === "Polygon"
      ? { ...geometry, coordinates: reverse(geometry.coordinates) }
      : { ...geometry, coordinates: geometry.coordinates.map(reverse) },
  };
}

export default function MarginShift() {
  const [chamber, setChamber] = useState<Chamber>("congressional");
  const [baseline, setBaseline] = useState<Baseline>("president");
  const [selected, setSelected] = useState("28");
  const [maps, setMaps] = useState<Partial<Record<Chamber, Boundaries>>>({});
  const [failed, setFailed] = useState<Chamber | null>(null);

  useEffect(() => {
    if (maps[chamber]) return;
    const controller = new AbortController();
    fetch(`/api/district-boundaries?chamber=${chamber}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Map unavailable");
        const map = await response.json() as Boundaries;
        if (!Array.isArray(map.features) || !map.features.length) throw new Error("Map unavailable");
        setMaps(previous => ({ ...previous, [chamber]: { ...map, features: map.features.map(normalize) } }));
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(chamber); });
    return () => controller.abort();
  }, [chamber, maps]);

  const map = maps[chamber];
  const paths = useMemo(() => {
    if (!map) return [];
    const project = geoPath(geoMercator().fitExtent([[12, 12], [708, 572]], map));
    return map.features.map(feature => ({ id: String(Number(feature.properties.DISTRICT)), path: project(feature) ?? "" }));
  }, [map]);

  const districts: Record<string, District> = data[chamber];
  const district = districts[selected];
  const result = shift(district, baseline);
  const ranked = Object.entries(districts).flatMap(([id, row]) => {
    const change = shift(row, baseline);
    return change === null ? [] : [{ id, row, change }];
  }).sort((a, b) => b.change - a.change || Number(a.id) - Number(b.id));
  const baseName = baseline === "prior" ? `${district.priorYear} general election` : baselines[baseline];

  return (
    <main className={styles.page}>
      <header>
        <p className={styles.eyebrow}>305 DATA GIRL · FLORIDA 2026 MIDTERM ELECTION</p>
        <h1>Democratic Margin Shift</h1>
        <p>See how the two-party margin moved across Florida’s congressional and state legislative districts.</p>
      </header>
      <div className={styles.controls}>
        <label>Chamber<select value={chamber} onChange={event => {
          const next = event.target.value as Chamber;
          setSelected(next === "congressional" ? "28" : "1");
          setFailed(null);
          setChamber(next);
        }}>
          {Object.entries(chambers).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select></label>
        <label>Baseline<select value={baseline} onChange={event => setBaseline(event.target.value as Baseline)}>
          {Object.entries(baselines).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select></label>
        <label>District<select value={selected} onChange={event => setSelected(event.target.value)}>
          {Object.keys(districts).map(id => <option key={id} value={id}>District {id}</option>)}
        </select></label>
      </div>
      <div className={styles.grid}>
        <section className={styles.card} aria-label="District map">
          <div className={styles.legend}>
            <span><i style={{ background: color(25) }} />Toward Democrats</span>
            <span><i style={{ background: color(-25) }} />Toward Republicans</span>
            <span><i style={{ background: color(0) }} />Even</span>
            <span><i style={{ background: color(null) }} />Unavailable</span>
          </div>
          {map ? <svg viewBox="0 0 720 584" aria-label={`${chambers[chamber]} district map`}>
            {paths.map(({ id, path }) => {
              if (!districts[id]) return null;
              const text = `District ${id} · ${label(shift(districts[id], baseline), " pts")}`;
              return <path key={id} d={path} fill={color(shift(districts[id], baseline))} data-selected={id === selected}
                role="button" tabIndex={0} aria-label={text} aria-pressed={id === selected}
                onClick={() => setSelected(id)} onKeyDown={event => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(id);
                  }
                }}><title>{text}</title></path>;
            })}
          </svg> : <p role="status">{failed === chamber ? "Map unavailable. Use the district selector to view results." : "Loading district boundaries…"}</p>}
          <p className={styles.muted}>{ranked.length} of {Object.keys(districts).length} districts have comparable results for this baseline.</p>
        </section>
        <section className={styles.card} aria-live="polite">
          <p className={styles.eyebrow}>{chambers[chamber]}</p>
          <h2>District {selected}</h2>
          <strong className={styles.result} style={{ color: result === null || Math.abs(result) < 0.005 ? undefined : result > 0 ? "#bad7ff" : "#ffc0ce" }}>{label(result, " pts")}</strong>
          <p className={styles.muted}>Shift in two-party margin</p>
          <dl>
            <dt>{baseName}</dt><dd>{label(margin(district[baseline]))}</dd>
            <dt>2026 district race</dt><dd>{label(margin(district.current))}</dd>
          </dl>
          {district.current && <p className={styles.muted}>2026 votes · {votes.format(district.current[0])} Democratic · {votes.format(district.current[1])} Republican</p>}
          {district.returnsSource && <p className={styles.links}><a href={district.returnsSource}>Florida Election Watch county totals</a> · First unofficial returns</p>}
          {district.status && <p>{district.status}.</p>}
          {!district[baseline] && <p>No two-party result available for this baseline.</p>}
          {chamber === "congressional" && baseline !== "president" && <p className={styles.note}>Same district number across different congressional plans. Boundary changes can contribute to the shift.</p>}
        </section>
      </div>
      <section className={styles.card} aria-labelledby="shift-ranking" style={{ marginBottom: 16, background: "#f8f5fc", color: "#261d37", borderColor: "#ded3ea" }}>
        <h2 id="shift-ranking">Districts ranked by Democratic shift</h2>
        <p style={{ color: "#574863" }}>{chambers[chamber]} · {baselines[baseline]} · {ranked.length} comparable districts</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 480, color: "#261d37", borderCollapse: "collapse", textAlign: "left" }}>
            <thead style={{ background: "#eee6f6", color: "#493858" }}>
              <tr>
                {["Rank", "District", "Baseline margin", "2026 margin", "Shift"].map(heading =>
                  <th key={heading} scope="col" style={{ padding: "8px 10px" }}>{heading}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ id, row, change }, index) => (
                <tr key={id} style={{ borderTop: "1px solid #ded3ea", background: id === selected ? "#e6ddf4" : index % 2 ? "#f3edf8" : "#fcfaff" }}>
                  <td style={{ padding: "8px 10px" }}>{index + 1}</td>
                  <th scope="row" style={{ padding: "8px 10px", background: "inherit", textTransform: "none", letterSpacing: "normal", fontSize: "inherit" }}>
                    <button type="button" aria-pressed={id === selected} onClick={() => setSelected(id)}
                      style={{ background: "transparent", color: "#352054", border: 0, padding: "5px 0", cursor: "pointer", textDecoration: "underline", font: "inherit" }}>
                      District {id}
                    </button>
                  </th>
                  <td style={{ padding: "8px 10px" }}>{label(margin(row[baseline]))}{baseline === "prior" && ` (${row.priorYear})`}</td>
                  <td style={{ padding: "8px 10px" }}>{label(margin(row.current))}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{
                      display: "inline-block", padding: "3px 8px", borderRadius: 6, fontWeight: 700,
                      color: Math.abs(change) < 0.005 ? "#44344f" : change > 0 ? "#214778" : "#802d4a",
                      background: Math.abs(change) < 0.005 ? "#e9e0ef" : change > 0 ? "#dceaff" : "#f8dce7",
                    }}>{label(change, " pts")}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!ranked.length && <p>No comparable districts for this baseline.</p>}
      </section>
      <section className={styles.card}>
        <h2>How the shift is calculated</h2>
        <p>Each margin is Democratic votes minus Republican votes, divided by their combined votes. The shift is the 2026 margin minus the selected baseline, in percentage points. Darker colors show larger shifts.</p>
        <p>The presidential baseline uses estimates of 2024 presidential votes on the district boundaries used in 2026. For the previous general election option, the map uses 2024 where the seat had a general election and 2022 otherwise. The 2026 results use an unofficial November 8 snapshot, supplemented for six districts with Florida Election Watch’s first unofficial returns after checking each county’s reporting. Races with partial precinct reporting or without both major parties are excluded from the shift.</p>
        <p className={styles.links}><a href="https://danieljchapman.github.io/fl/">Florida results exports</a> · <a href="https://floridaelectionwatch.gov/Downloads">Florida Election Watch</a> · <a href="https://github.com/ElectIndex/26_us_forecast_data">Presidential estimates</a> · <a href="https://www.flsenate.gov/Session/Redistricting">District boundaries</a></p>
        <p className={styles.eyebrow}>VANESSA BRITO · 305 DATA GIRL</p>
      </section>
    </main>
  );
}
