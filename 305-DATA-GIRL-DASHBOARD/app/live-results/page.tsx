"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ElectionContest, ElectionResultsPayload } from "../../lib/election-results";

const number = new Intl.NumberFormat("en-US");
const percent = (value: number) => `${value.toFixed(2)}%`;
const easternTime = (value: string | null) => value
  ? new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "America/New_York",
      timeZoneName: "short",
    }).format(new Date(value))
  : "Awaiting first report";

const partyClass = (party: string) => {
  const normalized = party.toUpperCase();
  if (normalized.includes("DEM")) return "candidate-dem";
  if (normalized.includes("REP")) return "candidate-rep";
  return "candidate-other";
};

const leaderDetails = (contest: ElectionContest | undefined) => {
  const leader = contest?.candidates[0];
  const runnerUp = contest?.candidates[1];
  return {
    leader,
    marginVotes: leader ? leader.votes - (runnerUp?.votes || 0) : 0,
    marginPoints: leader && runnerUp ? leader.percentage - runnerUp.percentage : 0,
  };
};

export default function LiveResultsPage() {
  const [data, setData] = useState<ElectionResultsPayload | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(30);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/election-results?t=${Date.now()}`, { cache: "no-store" });
      const payload = await response.json() as ElectionResultsPayload;
      setData(payload);
      if (!response.ok && payload.message) setError(payload.message);
      setSeconds(30);
    } catch {
      setError("The live results service did not respond. The page will retry automatically.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const refreshTimer = window.setInterval(() => void refresh(), 30_000);
    const countdownTimer = window.setInterval(() => setSeconds((value) => value <= 1 ? 30 : value - 1), 1_000);
    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(countdownTimer);
    };
  }, [refresh]);

  useEffect(() => {
    if (data?.contests.length && !data.contests.some((contest) => contest.id === selectedId)) {
      setSelectedId(data.contests[0].id);
    }
  }, [data, selectedId]);

  const selected = useMemo(
    () => data?.contests.find((contest) => contest.id === selectedId) || data?.contests[0],
    [data, selectedId],
  );
  const { leader, marginVotes, marginPoints } = leaderDetails(selected);
  const sourceUrl = data?.sourceUrl || "https://floridaelectionwatch.gov/";
  const status = data?.status || "waiting";
  const isWaiting = !data?.contests.length;

  return <main className="live-results-page">
    <header className="live-results-hero">
      <nav aria-label="Main navigation">
        <a href="/">Turnout dashboard</a>
        <a href="/landscape">County landscape</a>
        <a href="/results">Results directory</a>
        <a className="active" href="/live-results" aria-current="page">Live statewide results</a>
      </nav>
      <div className="results-brand"><span>305</span> Data Girl</div>
      <div className="live-results-heading">
        <div>
          <p className="results-kicker">OFFICIAL FLORIDA RESULTS</p>
          <h1>Live statewide election results</h1>
          <p>Candidate totals, margins and reporting progress from Florida Election Watch. Results refresh automatically every 30 seconds.</p>
        </div>
        <div className={`results-status status-${status}`}>
          <span><i /> {status === "live" ? "LIVE" : status === "stale" ? "STALE SNAPSHOT" : status === "error" ? "SOURCE UNAVAILABLE" : "AWAITING RESULTS"}</span>
          <b>{data?.electionName || "Florida August 2026 Primary Election"}</b>
          <small>Last official update: {easternTime(data?.sourceUpdatedAt || data?.generatedAt || null)}</small>
          <button onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : `Refresh now · ${seconds}s`}</button>
        </div>
      </div>
    </header>

    <section className="live-results-content">
      <aside className="unofficial-banner">
        <b>UNOFFICIAL RESULTS</b>
        <span>Results are unofficial until canvassing and certification are complete. Florida spans two time zones; statewide reporting begins after 8 p.m. Eastern.</span>
      </aside>

      {(error || data?.message) && <div className={`results-message status-${status}`}>{error || data?.message}</div>}

      {isWaiting ? <section className="results-waiting">
        <div className="waiting-pulse"><i /><i /><i /></div>
        <p className="results-kicker">CONNECTOR READY</p>
        <h2>Waiting for Florida Election Watch</h2>
        <p>The dashboard is online and checking the official feed every 30 seconds. Candidate graphs will appear here as soon as the state begins publishing results.</p>
        <a href={sourceUrl} target="_blank" rel="noreferrer">Open the official state source ↗</a>
      </section> : <>
        <div className="contest-tabs" role="tablist" aria-label="Statewide races">
          {data?.contests.map((contest) => <button
            key={contest.id}
            role="tab"
            aria-selected={contest.id === selected?.id}
            className={contest.id === selected?.id ? "active" : ""}
            onClick={() => setSelectedId(contest.id)}
          >
            <span>{contest.name}</span>
            <small>{number.format(contest.totalVotes)} votes</small>
          </button>)}
        </div>

        <section className="race-summary">
          <div className="race-title">
            <p className="results-kicker">SELECTED CONTEST</p>
            <h2>{selected?.name}</h2>
            <span>{selected?.reportingLabel || "Reporting progress not yet supplied"}</span>
          </div>
          <div className="race-kpis">
            <article><label>Votes counted</label><strong>{number.format(selected?.totalVotes || 0)}</strong></article>
            <article><label>Current leader</label><strong>{leader?.name || "—"}</strong><small>{leader ? `${leader.party} · ${percent(leader.percentage)}` : "—"}</small></article>
            <article><label>Leader’s margin</label><strong>{number.format(marginVotes)}</strong><small>{marginPoints.toFixed(2)} percentage points</small></article>
            <article><label>Reporting</label><strong>{selected?.reporting === null || selected?.reporting === undefined ? "—" : `${selected.reporting.toFixed(1)}%`}</strong><small>{selected?.reportingLabel || "Official source has not supplied progress"}</small></article>
          </div>
        </section>

        <section className="candidate-chart" aria-label={`${selected?.name || "Race"} candidate results`}>
          <header><div><p className="results-kicker">LIVE VOTE SHARE</p><h2>Candidate results</h2></div><span>Updated {easternTime(data?.sourceUpdatedAt || data?.generatedAt || null)}</span></header>
          <div className="candidate-bars">
            {selected?.candidates.map((candidate, index) => <article key={candidate.id} className={partyClass(candidate.party)}>
              <div className="candidate-rank">{index + 1}</div>
              <div className="candidate-info"><h3>{candidate.name}{candidate.winner && <span>✓</span>}</h3><p>{candidate.party}</p></div>
              <div className="candidate-track"><i style={{ width: `${candidate.percentage}%` }} /></div>
              <div className="candidate-numbers"><strong>{percent(candidate.percentage)}</strong><span>{number.format(candidate.votes)} votes</span></div>
            </article>)}
          </div>
        </section>
      </>}

      <footer className="live-results-footer">
        <p><b>Official source:</b> <a href={sourceUrl} target="_blank" rel="noreferrer">Florida Election Watch ↗</a></p>
        <p>County pages display only votes reported within that county. This page is designed for the complete statewide totals in federal and statewide contests.</p>
      </footer>
    </section>
  </main>;
}
