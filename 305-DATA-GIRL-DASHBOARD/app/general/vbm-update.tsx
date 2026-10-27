import snapshot from '../../public/data/general-official-snapshot.json';
import styles from './general.module.css';
const n=(v:number)=>v.toLocaleString('en-US');
const pct=(v:number)=>v.toFixed(2)+'%';
export default function VbmUpdate(){
 const t=snapshot.totals,b=snapshot.baseline,sent=t.provided.total+t.voted.total;
 return <section className={styles.tableCard} aria-label="October 27 mail and early voting update">
 <div className={styles.tableHead}><div><h2>October 27 mail + early voting update</h2><p>{snapshot.snapshotNotice}</p><p>All 67 VBM and 67 early-voting county originals verified. Activity through October 25, 2026.</p></div></div>
 <div className={styles.cards} style={{gridTemplateColumns:'repeat(3, minmax(0, 1fr))'}}>
 <article><label>Mail returned statewide</label><strong>{n(t.voted.total)}</strong><small>{pct(t.voted.total/sent*100)} of {n(sent)} issued</small></article>
 <article><label>Early in person</label><strong>{n(t.early.total)}</strong><small>Separate early-voting compilation</small></article>
 <article><label>Combined ballots cast</label><strong>{n(t.voted.total+t.early.total-snapshot.overlapCorrection.total)}</strong><small>Unique voters across mail and early</small></article>
 </div>
 <div className={styles.tableWrap}><table><thead><tr><th>Party</th><th>VBM issued</th><th>Mail returned</th><th>Return rate</th><th>Outstanding mail</th><th>Early in person</th><th>Combined cast</th><th>Mail change since Oct. 25</th></tr></thead><tbody>{(['dem','rep','npa','other'] as const).map(p=><tr key={p}><td>{p.toUpperCase()}</td><td>{n(t.provided[p]+t.voted[p])}</td><td>{n(t.voted[p])}</td><td>{pct(t.voted[p]/(t.provided[p]+t.voted[p])*100)}</td><td>{n(t.provided[p])}</td><td>{n(t.early[p])}</td><td>{n(t.voted[p]+t.early[p]-snapshot.overlapCorrection.parties[p])}</td><td>+{n(t.voted[p]-b[`${p}Returned`])}</td></tr>)}</tbody></table></div>
 <div className={styles.tableHead}><div><p><b>Reporting status:</b> All 67 VBM and all 67 early-voting county originals have October 27 portal uploads and reconcile to the 8:07 AM official compilation. No prior county records substituted. Portal upload dates are separate from individual activity dates; unchanged file hashes are disclosed. Sarasota retains 26 early records dated October 12. Live county totals may be newer and cannot be allocated to districts without newer district-coded files.</p><p><b>Comparisons:</b> {snapshot.dailyComparisonNote} All district changes use the previous verified mail and early-voting snapshot. Party registration does not indicate candidate choice.</p><p><a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Official Florida data</a> • <a href="/general/districts">All district breakdowns</a></p></div></div>
 </section>;
}
