"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ResultStatus = "live" | "stale" | "waiting" | "error";
type Candidate = { id: string; name: string; party: string | null; votes: number; voteShare: number };
type Contest = {
  id: string;
  name: string;
  candidates: Candidate[];
  totalVotes: number;
  precinctsReporting: number | null;
  totalPrecincts: number | null;
  reportingPercent: number | null;
};
type ResultsPayload = {
  status: ResultStatus;
  message?: string;
  contests: Contest[];
  sourceUrl?: string | null;
  sourceTimestamp?: string | null;
  verifiedAt?: string;
  refreshSeconds?: number;
};

const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function partyColor(party: string | null): "blue" | "red" | "gray" {
  const value = (party ?? "").toLowerCase();
  if (/democrat|democratic|^dem$/.test(value)) return "blue";
  if (/republican|^rep$|^gop$/.test(value)) return "red";
  return "gray";
}

function formatTimestamp(value?: string | null): string {
  if (!value) return "Not provided by the official feed";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "long" });
}

export default function LiveResultsPage() {
  const [data, setData] = useState<ResultsPayload | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const response = await fetch("/api/election-results", { cache: "no-store" });
      const payload = await response.json() as ResultsPayload;
      if (!response.ok && payload.status !== "error") throw new Error("Results service returned an unexpected response.");
      setData(payload);
      setClientError(null);
      if (payload.contests.length) {
        setSelectedId((current) => payload.contests.some((contest) => contest.id === current) ? current : payload.contests[0].id);
      }
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Unable to reach the results service.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), (data?.refreshSeconds ?? 30) * 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [data?.refreshSeconds, refresh]);

  const contest = useMemo(() => data?.contests.find((item) => item.id === selectedId) ?? data?.contests[0] ?? null, [data, selectedId]);
  const leader = contest?.candidates[0] ?? null;
  const runnerUp = contest?.candidates[1] ?? null;
  const rawMargin = leader ? leader.votes - (runnerUp?.votes ?? 0) : 0;
  const pointMargin = leader ? leader.voteShare - (runnerUp?.voteShare ?? 0) : 0;
  const status = clientError ? "error" : data?.status;

  return <main className="live-results-page">
    <header className="live-results-hero">
      <nav aria-label="Main navigation"><Link href="/">Turnout dashboard</Link><Link href="/results">County results</Link><Link className="active" href="/live-results" aria-current="page">Live statewide results</Link></nav>
      <div className="live-results-brand"><b>305</b> Data Girl</div>
      <p className="live-results-kicker"><span className={status === "live" ? "pulse" : ""} /> FLORIDA ELECTION WATCH</p>
      <h1>Florida statewide<br/><em>election results</em></h1>
      <p className="live-results-intro">Federal and statewide contests, reported directly from Florida’s official machine-readable results feed.</p>
      <div className="live-results-status">
        <span className={`status-badge status-${status ?? "loading"}`}>{status === "live" ? "Live official feed" : status === "stale" ? "Last verified results" : status === "waiting" ? "Waiting for results" : status === "error" ? "Feed unavailable" : "Connecting"}</span>
        <span>Automatic refresh every {data?.refreshSeconds ?? 30} seconds</span>
        <button type="button" onClick={() => void refresh(true)} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh now"}</button>
      </div>
    </header>

    <section className="live-results-content" aria-live="polite">
      {(status === "stale" || clientError) && <div className="results-alert alert-stale"><b>Stale-data warning</b><span>{clientError ?? data?.message ?? "The official feed is unavailable. Showing the last verified snapshot."}</span></div>}
      {status === "error" && !clientError && <div className="results-alert alert-error"><b>Official feed unavailable</b><span>{data?.message ?? "Results cannot be loaded right now."}</span></div>}
      {(!data || status === "waiting") && <div className="results-waiting">
        <span className="waiting-icon" aria-hidden="true">⌁</span>
        <p className="live-results-kicker">OFFICIAL RESULTS</p>
        <h2>{data ? "Waiting for results to be published" : "Connecting to the official feed"}</h2>
        <p>{data?.message ?? "Checking Florida Election Watch for statewide and federal contest results."}</p>
        {data?.sourceUrl && <a href={data.sourceUrl} target="_blank" rel="noreferrer">Visit Florida Election Watch ↗</a>}
      </div>}

      {contest && <>
        <div className="contest-toolbar">
          <div><p className="live-results-kicker">SELECT A CONTEST</p><label htmlFor="contest-select">Statewide and federal contests</label></div>
          <select id="contest-select" value={contest.id} onChange={(event) => setSelectedId(event.target.value)}>{data?.contests.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        </div>

        <article className="contest-card">
          <div className="contest-heading">
            <div><span>{status === "stale" ? "LAST VERIFIED" : "STATEWIDE RESULTS"}</span><h2>{contest.name}</h2></div>
            <div className="reporting-block"><b>{contest.reportingPercent === null ? "—" : `${percentFormatter.format(contest.reportingPercent)}%`}</b><span>reporting</span>{contest.precinctsReporting !== null && contest.totalPrecincts !== null && <small>{numberFormatter.format(contest.precinctsReporting)} of {numberFormatter.format(contest.totalPrecincts)} precincts</small>}</div>
          </div>

          <div className="leader-panel">
            <div><span>CURRENT LEADER</span><strong>{leader?.name ?? "No leader yet"}</strong><small>{leader?.party ?? "Party not reported"}</small></div>
            <div><span>RAW MARGIN</span><strong>{numberFormatter.format(rawMargin)}</strong><small>votes</small></div>
            <div><span>POINT MARGIN</span><strong>{percentFormatter.format(pointMargin)}</strong><small>percentage points</small></div>
          </div>

          <div className="candidate-results">{contest.candidates.map((candidate, index) => <div className="candidate-row" key={candidate.id}>
            <div className="candidate-name"><i className={`party-dot ${partyColor(candidate.party)}`} /><div><strong>{candidate.name}{index === 0 && <span className="leader-tag">LEADER</span>}</strong><small>{candidate.party ?? "Party not reported"}</small></div></div>
            <div className="candidate-votes"><strong>{numberFormatter.format(candidate.votes)}</strong><span>votes</span></div>
            <div className="candidate-share"><strong>{percentFormatter.format(candidate.voteShare)}%</strong><div className="share-track" aria-label={`${candidate.name}: ${percentFormatter.format(candidate.voteShare)} percent`}><i className={partyColor(candidate.party)} style={{ width: `${Math.min(candidate.voteShare, 100)}%` }} /></div></div>
          </div>)}</div>

          <footer className="contest-source"><div><span>OFFICIAL SOURCE TIMESTAMP</span><b>{formatTimestamp(data?.sourceTimestamp)}</b>{data?.verifiedAt && <small>Snapshot verified {formatTimestamp(data.verifiedAt)}</small>}</div>{data?.sourceUrl && <a href={data.sourceUrl} target="_blank" rel="noreferrer">View official source ↗</a>}</footer>
        </article>
      </>}

      <aside className="unofficial-notice"><b>Important notice</b><p>Results are unofficial until canvassing and certification are complete.</p></aside>
    </section>
  </main>;
}
