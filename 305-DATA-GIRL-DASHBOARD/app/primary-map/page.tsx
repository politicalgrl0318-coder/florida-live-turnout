"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { primaryCounties, primaryTotals } from "./data";
import "./map.css";

const number = new Intl.NumberFormat("en-US");
const pct = (value: number) => `${value.toFixed(2)}%`;

function color(margin: number) {
  if (margin >= 20) return "#1464a5";
  if (margin >= 10) return "#3f87c5";
  if (margin >= 0) return "#8ec2e8";
  if (margin > -10) return "#f0a39e";
  if (margin > -20) return "#d8615b";
  return "#a72f2a";
}

export default function PrimaryMapPage() {
  const [selectedName, setSelectedName] = useState("Miami-Dade");
  const selected = useMemo(
    () => primaryCounties.find((county) => county.name === selectedName) ?? primaryCounties[0],
    [selectedName],
  );
  const demShare = selected.total ? (selected.dem / selected.total) * 100 : 0;
  const repShare = selected.total ? (selected.rep / selected.total) * 100 : 0;
  const statewideTotal = primaryTotals.dem + primaryTotals.rep;
  const statewideRepShare = (primaryTotals.rep / statewideTotal) * 100;
  const statewideDemShare = (primaryTotals.dem / statewideTotal) * 100;

  return (
    <main className="primary-map-page">
      <header className="map-hero">
        <div>
          <p className="map-kicker">2026 FLORIDA PRIMARY • OFFICIAL UNOFFICIAL RESULTS</p>
          <h1>Where each party turned out</h1>
          <p className="map-intro">
            County-level Democratic and Republican ballots in Florida’s gubernatorial primaries.
            Select a county to compare its party turnout with the statewide result.
          </p>
        </div>
        <Link href="/" className="back-link">← Return to dashboard</Link>
      </header>

      <nav className="map-tabs" aria-label="Primary results views">
        <Link href="/">Statewide dashboard</Link>
        <span aria-current="page">Interactive primary map</span>
      </nav>

      <section className="map-summary" aria-label="Statewide primary totals">
        <article><span>Republican ballots</span><strong className="map-red">{number.format(primaryTotals.rep)}</strong><small>{pct(statewideRepShare)}</small></article>
        <article><span>Democratic ballots</span><strong className="map-blue">{number.format(primaryTotals.dem)}</strong><small>{pct(statewideDemShare)}</small></article>
        <article><span>Statewide advantage</span><strong className="map-red">R +{number.format(primaryTotals.rep - primaryTotals.dem)}</strong><small>{pct(statewideRepShare - statewideDemShare)} points</small></article>
      </section>

      <section className="map-workspace">
        <div className="map-card">
          <div className="map-card-head">
            <div><h2>Democratic vs. Republican primary ballots</h2><p>Blue counties cast more Democratic ballots; red counties cast more Republican ballots.</p></div>
            <div className="legend"><span><i className="legend-blue"/>D advantage</span><span><i className="legend-red"/>R advantage</span></div>
          </div>
          <svg className="florida-map" viewBox="0 0 860 650" role="img" aria-label="Interactive Florida county primary turnout map">
            {primaryCounties.map((county) => (
              <path
                key={county.id}
                d={county.path}
                fill={color(county.margin)}
                className={county.name === selected.name ? "selected" : ""}
                onClick={() => setSelectedName(county.name)}
                onMouseEnter={() => setSelectedName(county.name)}
                tabIndex={0}
                role="button"
                aria-label={`${county.name}: ${county.margin >= 0 ? "Democratic" : "Republican"} advantage ${Math.abs(county.margin).toFixed(1)} points`}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelectedName(county.name);
                }}
              />
            ))}
          </svg>
          <div className="scale" aria-hidden="true"><span>D +20</span><i/><i/><i/><i/><i/><i/><span>R +20</span></div>
        </div>

        <aside className="county-detail">
          <p className="detail-label">SELECTED COUNTY</p>
          <h2>{selected.name}</h2>
          <div className="county-margin">
            <span>Two-party turnout margin</span>
            <strong className={selected.margin >= 0 ? "map-blue" : "map-red"}>
              {selected.margin >= 0 ? "D" : "R"} +{Math.abs(selected.margin).toFixed(2)}
            </strong>
          </div>
          <div className="share-bar"><i style={{width: `${demShare}%`}}/><b style={{width: `${repShare}%`}}/></div>
          <div className="county-numbers">
            <div><span>Democratic</span><strong className="map-blue">{number.format(selected.dem)}</strong><small>{pct(demShare)}</small></div>
            <div><span>Republican</span><strong className="map-red">{number.format(selected.rep)}</strong><small>{pct(repShare)}</small></div>
          </div>
          <div className="comparison">
            <span>Compared with statewide</span>
            <strong>{pct(Math.abs((repShare - demShare) - (statewideRepShare - statewideDemShare)))}-point difference</strong>
          </div>
        </aside>
      </section>

      <section className="map-explanation">
        <h2>How to read this map</h2>
        <p>
          This maps party turnout—not persuasion. Florida’s primary is closed, so the raw Democratic–Republican
          difference reflects each county’s party-registration base and how successfully each party turned out
          its own voters. It is a useful measure of organization and enthusiasm, but it is not a direct forecast
          of November, when NPA voters and cross-party candidate choices matter.
        </p>
        <p className="map-source">Source: Florida Election Watch, August 18, 2026 primary results. Results remain unofficial until canvassing and certification are complete.</p>
      </section>
    </main>
  );
}
