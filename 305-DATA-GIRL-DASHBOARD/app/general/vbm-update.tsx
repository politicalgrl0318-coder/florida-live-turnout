import snapshot from '../../public/data/general-official-snapshot.json';
import styles from './general.module.css';
const n=(v:number)=>v.toLocaleString('en-US');
const pct=(v:number)=>v.toFixed(2)+'%';
export default function VbmUpdate(){
 const t=snapshot.totals,b=snapshot.baseline,sent=t.provided.total+t.voted.total;
 return <section className={styles.tableCard} aria-label="October 23 mail and early voting update">
 <div className={styles.tableHead}><div><h2>October 23 mail + early voting update</h2><p>{snapshot.snapshotNotice}</p><p>All 67 county VBM originals and 48 early-voting originals verified. The other 19 counties had not opened early voting for the reported day. Activity through October 22.</p></div></div>
 <div className={styles.cards} style={{gridTemplateColumns:'repeat(3, minmax(0, 1fr))'}}>
 <article><label>Mail returned statewide</label><strong>{n(t.voted.total)}</strong><small>{pct(t.voted.total/sent*100)} of {n(sent)} issued</small></article>
 <article><label>Early in person</label><strong>{n(t.early.total)}</strong><small>Separate early-voting compilation</small></article>
 <article><label>Combined ballots cast</label><strong>{n(t.voted.total+t.early.total)}</strong><small>Mail returned + early in person</small></article>
 </div>
 <div className={styles.tableWrap}><table><thead><tr><th>Party</th><th>VBM issued</th><th>Mail returned</th><th>Return rate</th><th>Outstanding mail</th><th>Early in person</th><th>Combined cast</th><th>Mail change since Oct. 22</th></tr></thead><tbody>{(['dem','rep','npa','other'] as const).map(p=><tr key={p}><td>{p.toUpperCase()}</td><td>{n(t.provided[p]+t.voted[p])}</td><td>{n(t.voted[p])}</td><td>{pct(t.voted[p]/(t.provided[p]+t.voted[p])*100)}</td><td>{n(t.provided[p])}</td><td>{n(t.early[p])}</td><td>{n(t.voted[p]+t.early[p])}</td><td>+{n(t.voted[p]-b[`${p}Returned`])}</td></tr>)}</tbody></table></div>
 <div className={styles.tableHead}><div><p><b>Reporting status:</b> All 67 VBM county originals and 48 early-voting originals verified against both original statewide archives. Archive compilation 8:04:19 AM ET; official state compilation 8:05 AM ET. Eleven additional counties are newly reporting early voting; coverage growth and backfills are separate from voting-day activity. Sarasota retains 26 early records dated October 12. Live county feeds remain separately timestamped.</p><p><b>Comparisons:</b> {snapshot.dailyComparisonNote} All district changes use the previous verified mail and early-voting snapshot. Party registration does not indicate candidate choice.</p><p><a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Official Florida data</a> • <a href="/general/districts">All district breakdowns</a></p></div></div>
 </section>;
}
