"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const coverage = [
  "Baker","Bay","Bradford","Brevard","Calhoun","Charlotte","Citrus","Clay",
  "Collier","Columbia","Dixie","Duval","Gadsden","Gilchrist","Glades","Gulf",
  "Hardee","Hendry","Hernando","Highlands","Holmes","Indian River","Jackson",
  "Jefferson","Lafayette","Lake","Lee","Leon","Liberty","Madison","Marion",
  "Miami-Dade","Monroe","Nassau","Okeechobee","Pasco","Polk","Putnam",
  "Sarasota","St. Johns","St. Lucie","Sumter","Taylor","Union","Volusia",
  "Wakulla","Walton","Washington"
];

const pending = [
  "Alachua","Broward","DeSoto","Escambia","Flagler","Franklin","Hamilton",
  "Hillsborough","Levy","Manatee","Martin","Okaloosa","Orange","Osceola",
  "Palm Beach","Pinellas","Santa Rosa","Seminole","Suwannee"
];

export default function SenatePrecinctMapPreview() {
  const [query, setQuery] = useState("");
  const shown = useMemo(
    () => coverage.filter((county) => county.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  return (
    <main style={{maxWidth:1180,margin:"0 auto",padding:"42px 22px 72px",fontFamily:"var(--font-geist-sans)"}}>
      <header style={{padding:"34px",borderRadius:28,background:"linear-gradient(135deg,#071d36,#123b63)",color:"#fff"}}>
        <p style={{letterSpacing:".14em",fontWeight:800,fontSize:12,margin:0}}>305 DATA GIRL • 2026 PRIMARY</p>
        <h1 style={{fontSize:"clamp(34px,6vw,66px)",lineHeight:1.02,margin:"14px 0"}}>Nixon vs. Vindman<br/>precinct-map preview</h1>
        <p style={{maxWidth:760,fontSize:18,lineHeight:1.55,opacity:.9}}>
          A source-backed statewide precinct project built from Florida county election files.
          This preview shows collection coverage while county geometry and the enacted 2026
          congressional-district crosswalk are being validated.
        </p>
        <Link href="/" style={{color:"#fff",fontWeight:800}}>← Return to dashboard</Link>
      </header>

      <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16,margin:"24px 0"}}>
        <article style={{padding:24,border:"1px solid #dce5ee",borderRadius:20}}><span>Precinct records collected</span><strong style={{display:"block",fontSize:38,marginTop:8}}>2,917</strong></article>
        <article style={{padding:24,border:"1px solid #dce5ee",borderRadius:20}}><span>Counties collected</span><strong style={{display:"block",fontSize:38,marginTop:8}}>48 of 67</strong></article>
        <article style={{padding:24,border:"1px solid #dce5ee",borderRadius:20}}><span>Counties pending</span><strong style={{display:"block",fontSize:38,marginTop:8}}>19</strong></article>
      </section>

      <section style={{padding:28,border:"1px solid #dce5ee",borderRadius:24}}>
        <div style={{display:"flex",gap:16,justifyContent:"space-between",alignItems:"end",flexWrap:"wrap"}}>
          <div><h2 style={{fontSize:28,margin:"0 0 8px"}}>Validated collection coverage</h2><p style={{margin:0,color:"#516273"}}>These counties have candidate-by-precinct results in the normalized dataset.</p></div>
          <input aria-label="Search collected counties" placeholder="Search county…" value={query} onChange={(event)=>setQuery(event.target.value)}
            style={{padding:"12px 14px",border:"1px solid #b8c5d1",borderRadius:12,fontSize:16}}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginTop:22}}>
          {shown.map((county)=><div key={county} style={{padding:"11px 13px",borderRadius:10,background:"#eaf6ef",color:"#135c37",fontWeight:750}}>✓ {county}</div>)}
        </div>
      </section>

      <section style={{padding:28,marginTop:20,borderRadius:24,background:"#fff4e5",border:"1px solid #ffd59b"}}>
        <h2 style={{marginTop:0}}>Why this is labeled a preview</h2>
        <p style={{lineHeight:1.65}}>The remaining counties use separate election-reporting systems or require custom exports. Precincts must also be assigned to the enacted 2026 congressional districts, including split precincts. Missing counties are not treated as zero votes.</p>
        <p style={{fontWeight:800,marginBottom:8}}>Pending: {pending.join(", ")}.</p>
        <p style={{marginBottom:0}}>Results are unofficial until canvassing and certification are complete. Sources: county Supervisors of Elections, Florida Election Watch and Florida’s official 2026 congressional redistricting files.</p>
      </section>
    </main>
  );
}
