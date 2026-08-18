"use client";

import { useMemo, useState } from "react";
import styles from "./results-wall.module.css";

type CountyResult = {
  name: string;
  url: string;
  isDirect: boolean;
};

const names = `Alachua|Baker|Bay|Bradford|Brevard|Broward|Calhoun|Charlotte|Citrus|Clay|Collier|Columbia|DeSoto|Dixie|Duval|Escambia|Flagler|Franklin|Gadsden|Gilchrist|Glades|Gulf|Hamilton|Hardee|Hendry|Hernando|Highlands|Hillsborough|Holmes|Indian River|Jackson|Jefferson|Lafayette|Lake|Lee|Leon|Levy|Liberty|Madison|Manatee|Marion|Martin|Miami-Dade|Monroe|Nassau|Okaloosa|Okeechobee|Orange|Osceola|Palm Beach|Pasco|Pinellas|Polk|Putnam|Santa Rosa|Sarasota|Seminole|St. Johns|St. Lucie|Sumter|Suwannee|Taylor|Union|Volusia|Wakulla|Walton|Washington`.split("|");

const augustPrimaryLinks: Partial<Record<string, string>> = {
  Alachua: "https://enr.electionsfl.org/ALA/4023/Summary/",
  Bay: "https://enr.electionsfl.org/BAY/4001/Summary/",
  Bradford: "https://enr.electionsfl.org/BRA/4017/Summary/",
  Calhoun: "https://enr.electionsfl.org/CAL/3984/Summary/",
  Charlotte: "https://enr.electionsfl.org/CHA/4016/Summary/",
  Citrus: "https://enr.electionsfl.org/CIT/3991/Summary/",
  Clay: "https://enr.electionsfl.org/CLA/3990/Summary/",
  Collier: "https://enr.electionsfl.org/CLL/4039/Summary/",
  Columbia: "https://enr.electionsfl.org/CLM/4020/Summary/",
  DeSoto: "https://enr.electionsfl.org/DES/3997/Summary/",
  Dixie: "https://enr.electionsfl.org/DIX/3988/Summary/",
  Duval: "https://enr.electionsfl.org/DUV/4003/Summary/",
  Flagler: "https://enr.electionsfl.org/FLA/4029/Summary/",
  Franklin: "https://enr.electionsfl.org/FRA/4028/Summary/",
  Gadsden: "https://enr.electionsfl.org/GAD/4009/Summary/",
  Gilchrist: "https://enr.electionsfl.org/GIL/3987/Summary/",
  Glades: "https://enr.electionsfl.org/GLA/3978/Summary/",
  Hamilton: "https://enr.electionsfl.org/HAM/4019/Summary/",
  Hardee: "https://enr.electionsfl.org/HAR/3946/Summary/",
  Hendry: "https://enr.electionsfl.org/HEN/3983/Summary/",
  Hernando: "https://enr.electionsfl.org/HER/4046/Summary/",
  Hillsborough: "https://enr.electionsfl.org/HIL/4002/Summary/",
  Holmes: "https://enr.electionsfl.org/HOL/4040/Summary/",
  "Indian River": "https://enr.electionsfl.org/IND/4032/Summary/",
  Jackson: "https://enr.electionsfl.org/JAC/4048/Summary/",
  Lake: "https://enr.electionsfl.org/LAK/3996/Summary/",
  Leon: "https://enr.electionsfl.org/LEO/3994/Summary/",
  Levy: "https://enr.electionsfl.org/LEV/3992/Summary/",
  Liberty: "https://enr.electionsfl.org/LIB/4049/Summary/",
  Madison: "https://enr.electionsfl.org/MAD/4008/Summary/",
  Manatee: "https://enr.electionsfl.org/MAN/4031/Summary/",
  Marion: "https://enr.electionsfl.org/MRN/4007/Summary/",
  Martin: "https://results.enr.clarityelections.com/FL/Martin/126768/web.345435/#/summary",
  "Miami-Dade": "https://enr.electionsfl.org/DAD/4010/Summary/",
  Monroe: "https://enr.electionsfl.org/MON/4006/Summary/",
  Nassau: "https://enr.electionsfl.org/NAS/4021/Summary/",
  Okeechobee: "https://enr.electionsfl.org/OKE/3907/Summary/",
  Pasco: "https://enr.electionsfl.org/PAS/4045/Summary/",
  Polk: "https://enr.electionsfl.org/POL/3999/Summary/",
  Putnam: "https://enr.electionsfl.org/PUT/4013/Summary/",
  "Santa Rosa": "https://enr.electionsfl.org/SAN/4036/Summary/",
  Sarasota: "https://enr.electionsfl.org/SAR/4038/Summary/",
  Seminole: "https://www.livevoterturnout.com/ENR/semflenr/21/en/Index_21.html",
  "St. Johns": "https://enr.electionsfl.org/STJ/4011/Summary/",
  "St. Lucie": "https://enr.electionsfl.org/STL/4030/Summary/",
  Sumter: "https://enr.electionsfl.org/SUM/3989/Summary/",
  Taylor: "https://enr.electionsfl.org/TAY/4018/Summary/",
  Union: "https://enr.electionsfl.org/UNI/3981/Summary/",
  Volusia: "https://enr.electionsfl.org/VOL/4004/Summary/",
  Wakulla: "https://enr.electionsfl.org/WAK/3962/Summary/",
  Walton: "https://enr.electionsfl.org/WAL/4027/Summary/",
};

const electionWatchUrl = "https://floridaelectionwatch.gov/";

const countyResults: CountyResult[] = names.map((name) => ({
  name,
  url: augustPrimaryLinks[name] || electionWatchUrl,
  isDirect: Boolean(augustPrimaryLinks[name]),
}));

const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function ResultsPage() {
  const [query, setQuery] = useState("");
  const counties = useMemo(
    () => countyResults.filter((county) => county.name.toLowerCase().includes(query.trim().toLowerCase())),
    [query],
  );
  const linked = countyResults.filter((county) => county.isDirect).length;

  return (
    <main className="results-page">
      <header className="results-hero">
        <nav aria-label="Main navigation">
          <a href="/">Turnout dashboard</a>
          <a href="/landscape">County landscape</a>
          <a className="active" href="/results" aria-current="page">County results</a>
          <a href="/live-results">Live statewide results</a>
        </nav>
        <div className="results-brand"><span>305</span> Data Girl</div>
        <p className="results-kicker">ALL 67 COUNTIES · ONE PAGE</p>
        <h1>Florida August 2026 Primary Election Results</h1>
        <p className="results-intro">
          Scroll Florida county by county without leaving 305 Data Girl. Every county has its own live results frame and a direct link back to the official election source.
        </p>
      </header>

      <section className="results-content">
        <article className="statewide-card">
          <div>
            <span className="official-pill">OFFICIAL STATEWIDE SOURCE</span>
            <h2>Federal, statewide &amp; multicounty races</h2>
            <p>Florida Election Watch publishes results reported to the Florida Department of State. Use it for contests that cross county lines.</p>
          </div>
          <a href={electionWatchUrl} target="_blank" rel="noreferrer">Open Florida Election Watch <span>↗</span></a>
        </article>

        <aside className="results-explainer">
          Results are unofficial until canvassing and certification are complete
        </aside>

        <div className="county-directory-head">
          <div>
            <p className="results-kicker">LIVE COUNTY RESULTS WALL</p>
            <h2>All 67 counties, right here</h2>
            <span>{linked} direct county result pages · {67 - linked} Florida Election Watch fallbacks</span>
          </div>
          <label>
            <span>Filter counties</span>
            <input
              aria-label="Filter counties"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Start typing a county…"
            />
          </label>
        </div>

        <div className={styles.wall}>
          {counties.map((county) => (
            <article key={county.name} id={slugify(county.name)} className={styles.countyFrame}>
              <div className={styles.frameHeader}>
                <div className={styles.countyIdentity}>
                  <span className="county-mark">{county.name.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <h3>{county.name} County</h3>
                    <p>{county.isDirect ? "Official county election results" : "Official statewide reporting fallback"}</p>
                  </div>
                </div>
                <div className={styles.frameActions}>
                  <span className={county.isDirect ? styles.directBadge : styles.fallbackBadge}>
                    {county.isDirect ? "COUNTY SOURCE" : "STATE FALLBACK"}
                  </span>
                  <a
                    href={county.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open official ${county.name} County election results in a new tab`}
                  >
                    Open official results <span>↗</span>
                  </a>
                </div>
              </div>

              <div className={styles.embedShell}>
                <iframe
                  src={county.url}
                  title={`${county.name} County 2026 primary election results`}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>

              <div className={styles.frameFooter}>
                <span>Live official election source</span>
                <span>If the county blocks embedded viewing, use “Open official results” above.</span>
              </div>
            </article>
          ))}
        </div>

        {!counties.length && <p className="no-counties">No counties match “{query}.”</p>}

        <p className="directory-note">
          <b>Source note:</b> 305 Data Girl embeds verified county election-result pages where a stable county-specific source is available. Counties without a stable election-specific URL use Florida Election Watch as the official fallback. External election vendors control whether their pages allow embedded viewing; every county card also includes a direct official-source link.
        </p>
      </section>
    </main>
  );
}
