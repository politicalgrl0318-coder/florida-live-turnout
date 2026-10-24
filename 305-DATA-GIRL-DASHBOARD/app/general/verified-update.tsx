import snapshot from "../../public/data/general-verified-update.json";
import styles from "./general.module.css";

const parties = ["dem", "rep", "npa", "other"] as const;
const n = (value: number) => new Intl.NumberFormat("en-US").format(value);
const et = (value: string) => new Intl.DateTimeFormat("en-US", {month:"short",day:"numeric",hour:"numeric",minute:"2-digit",second:"2-digit",timeZone:"America/New_York",timeZoneName:"short"}).format(new Date(value));
type Counts = {total:number;dem:number;rep:number;npa:number;other:number;unallocated:number};
const margin = (row: Counts) => row.dem === row.rep ? "Even" : `${row.dem > row.rep ? "D" : "R"} +${n(Math.abs(row.dem-row.rep))}`;
const share = (value:number,total:number) => total ? `${(100*value/total).toFixed(2)}%` : "—";
const reconciles = (row:Counts) => [...parties,"unallocated" as const].every(key=>Number.isSafeInteger(row[key])&&row[key]>=0) && row.total === parties.reduce((sum,key)=>sum+row[key],row.unallocated);

export default function VerifiedUpdate(){
 const rows:[string,Counts][]=[["Vote by mail",snapshot.methods.mail],["Early voting",snapshot.methods.early],["Combined",snapshot.combined]];
 const methods=[snapshot.methods.mail,snapshot.methods.early,snapshot.methods.electionDay];
 const valid=String(snapshot.electionNumber)==="49894"&&snapshot.electionDate==="2026-11-03"&&rows.every(([,row])=>reconciles(row))&&methods.every(reconciles)&&[...parties,"total" as const,"unallocated" as const].every(key=>methods.reduce((sum,row)=>sum+row[key],0)===snapshot.combined[key]);
 if(!valid)return <section className={styles.error} role="alert">The saved verified update failed reconciliation and is withheld. Consult the separately verified county reports below.</section>;
 const delta=snapshot.comparison.reportedChange;
 return <section id="verified-update" aria-labelledby="verified-update-title" data-verified-update="2026-10-24T22:17:17.259682Z" className={styles.tableCard} style={{marginTop:18,marginBottom:20,padding:18}}>
  <div className={styles.tableHead}><div><h2 id="verified-update-title">Verified statewide update</h2><p><strong>October 24, 2026 · verified {et(snapshot.checkedAt)}</strong><br/>Dated county-method snapshot · Election 49894 · 67 of 67 counties. This is a saved verification, not a new live retrieval.</p></div><a href="/data/general-verified-update.json" target="_blank" rel="noreferrer">Snapshot, sources &amp; corrections ↗</a></div>
  <div className={styles.cards}>
   <article><label>Combined reported ballots</label><strong>{n(snapshot.combined.total)}</strong><small>{margin(snapshot.combined)} by registered party</small></article>
   <article><label>Vote-by-mail returns</label><strong>{n(snapshot.methods.mail.total)}</strong><small>{margin(snapshot.methods.mail)}</small></article>
   <article><label>In-person early voting</label><strong>{n(snapshot.methods.early.total)}</strong><small>{margin(snapshot.methods.early)}</small></article>
   <article><label>Election Day</label><strong>Not begun</strong><small>0 included; scheduled for November 3</small></article>
  </div>
  <div className={styles.tableWrap}><table><caption style={{textAlign:"left",paddingBottom:8}}>Registered-party counts and shares of all reported ballots in each method</caption><thead><tr><th>Method</th>{parties.map(p=><th key={p}>{p==="other"?"Other":p.toUpperCase()}</th>)}<th>Unallocated</th><th>D–R margin</th></tr></thead><tbody>{rows.map(([label,row])=><tr key={label}><th scope="row">{label}</th>{parties.map(p=><td key={p}>{n(row[p])}<small>{share(row[p],row.total)}</small></td>)}<td>{n(row.unallocated)}</td><td>{margin(row)}</td></tr>)}</tbody></table></div>
  <p className={styles.registrationNote}><strong>Coverage:</strong> 65 counties use the latest reconciled reports in this extraction; Miami-Dade and Glades retain earlier verified reports. No state fallback, missing active method, unavailable county, or prior-day stale report is included. Source timestamps span {et(snapshot.sourceTimestampRange.oldest)} to {et(snapshot.sourceTimestampRange.newest)}. Three ballots remain unallocated by party.</p>
  <p className={styles.registrationNote}><strong>Reporting correction, not an 18,148-vote surge:</strong> Broward’s newer early-voting report replaced a delayed state fallback. Of the {n(delta.combined.total)} additional reported ballots versus the comparable {et(snapshot.comparison.previousComparableCheckedAt)} snapshot, {n(snapshot.comparison.browardEarlyFallbackReplacement.total)} reflect that coverage replacement. The remaining {n(snapshot.comparison.remainingNetReportedChange)} are a net reported change and may include revisions—not necessarily ballots cast during the interval.</p>
  <details><summary>Changes by method and party; retained-report notes</summary><div className={styles.tableWrap}><table><thead><tr><th>Reported change</th><th>Total</th>{parties.map(p=><th key={p}>{p==="other"?"Other":p.toUpperCase()}</th>)}<th>Unallocated</th></tr></thead><tbody>{([["Vote by mail",delta.mail],["Early voting",delta.early],["Election Day",delta.electionDay],["Combined",delta.combined]] as [string,Counts][]).map(([label,row])=><tr key={label}><th scope="row">{label}</th>{(["total",...parties,"unallocated"] as const).map(p=><td key={p}>{row[p]>0?"+":""}{n(row[p])}</td>)}</tr>)}</tbody></table></div>{snapshot.exceptions.map(note=><p key={note}>{note}</p>)}</details>
  <p className={styles.registrationNote}><strong>Keep the universes separate:</strong> This saved update and the automatic county selection below are alternative snapshots, not additive totals. Their timestamps, coverage, and revisions can differ. State benchmarks and district datasets retain their own dates. Provisional ballots are excluded. Party registration is not candidate preference.</p>
 </section>;
}
