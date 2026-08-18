"use client";

import { useState } from "react";
import Link from "next/link";

const counties = [
  {
    name: "Miami-Dade",
    url: "https://enr.electionsfl.org/DAD/4010/Summary/",
    code: "DAD",
  },
  {
    name: "Monroe",
    url: "https://enr.electionsfl.org/MON/4006/Summary/",
    code: "MON",
  },
];

export default function MiamiMonroeWatchPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="watch-page">
      <header className="watch-hero">
        <nav aria-label="Main navigation">
          <Link href="/">Turnout dashboard</Link>
          <Link href="/results">County results</Link>
          <Link href="/live-results">Live statewide results</Link>
          <Link className="active" href="/miami-monroe-results" aria-current="page">
            Miami-Dade + Monroe
          </Link>
        </nav>
        <div className="watch-brand"><b>305</b> Data Girl</div>
        <p className="watch-kicker"><span /> ELECTION NIGHT WATCH</p>
        <h1>Miami-Dade + Monroe<br/><em>Live Election Results</em></h1>
        <p className="watch-intro">
          Follow both counties from one screen. Results are loaded from each county’s official election reporting page.
        </p>
        <div className="watch-actions">
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>Refresh both counties</button>
          <span>Results are unofficial until canvassing and certification are complete.</span>
        </div>
      </header>

      <section className="watch-grid">
        {counties.map((county) => (
          <article className="county-panel" key={county.code}>
            <header>
              <div><span>{county.code}</span><h2>{county.name} County</h2></div>
              <a href={county.url} target="_blank" rel="noreferrer">Open official page ↗</a>
            </header>
            <iframe
              key={`${county.code}-${refreshKey}`}
              src={county.url}
              title={`${county.name} County official election results`}
              loading="eager"
              referrerPolicy="no-referrer"
            />
            <p className="frame-note">
              If the official county page blocks the embedded view, use “Open official page” above.
            </p>
          </article>
        ))}
      </section>

      <style jsx>{`
        :global(*){box-sizing:border-box}
        :global(body){margin:0;background:#f5f7fb;color:#14213d}
        .watch-page{min-height:100vh;font-family:Arial,Helvetica,sans-serif}
        .watch-hero{padding:24px clamp(20px,5vw,72px) 36px;background:linear-gradient(135deg,#071936 0%,#123d74 62%,#086788 100%);color:#fff}
        nav{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:34px}
        nav a{color:#dce9f8;text-decoration:none;padding:9px 13px;border:1px solid rgba(255,255,255,.2);border-radius:999px;font-size:13px}
        nav a.active{background:#fff;color:#123d74;font-weight:800}
        .watch-brand{font-size:20px;margin-bottom:32px}.watch-brand b{font-size:34px;margin-right:7px}
        .watch-kicker{font-size:12px;font-weight:900;letter-spacing:.16em;margin:0 0 12px}.watch-kicker span{display:inline-block;width:9px;height:9px;border-radius:50%;background:#21d07a;box-shadow:0 0 0 6px rgba(33,208,122,.14);margin-right:8px}
        h1{font-size:clamp(34px,5.4vw,70px);line-height:.98;letter-spacing:-.045em;margin:0;max-width:950px}
        h1 em{color:#67d2ff;font-style:normal}
        .watch-intro{font-size:17px;line-height:1.55;max-width:760px;color:#dce9f8}
        .watch-actions{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-top:22px}
        .watch-actions button{border:0;border-radius:9px;padding:12px 16px;background:#fff;color:#123d74;font-weight:800;cursor:pointer}
        .watch-actions span{font-size:13px;color:#c9d8eb}
        .watch-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;padding:28px clamp(16px,4vw,56px) 48px}
        .county-panel{background:#fff;border:1px solid #dce4ee;border-radius:18px;overflow:hidden;box-shadow:0 12px 34px rgba(27,52,85,.09)}
        .county-panel>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:17px 18px;border-bottom:1px solid #e5ebf2}
        .county-panel>header div{display:flex;align-items:center;gap:11px}.county-panel>header span{display:grid;place-items:center;width:42px;height:42px;border-radius:10px;background:#e9f4ff;color:#086788;font-size:12px;font-weight:900}
        h2{font-size:20px;margin:0}.county-panel a{color:#0969a8;font-size:13px;font-weight:800;text-decoration:none}
        iframe{display:block;width:100%;height:68vh;min-height:520px;border:0;background:#fff}
        .frame-note{margin:0;padding:10px 16px;background:#f7f9fc;border-top:1px solid #e5ebf2;color:#627186;font-size:11px}
        @media(max-width:900px){.watch-grid{grid-template-columns:1fr}iframe{height:72vh}.watch-hero{padding-top:18px}}
      `}</style>
    </main>
  );
}
