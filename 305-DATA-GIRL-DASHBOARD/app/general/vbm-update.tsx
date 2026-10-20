import snapshot from '../../public/data/general-official-snapshot.json';
import styles from './general.module.css';
const n=(v:number)=>v.toLocaleString('en-US');
const pct=(v:number)=>v.toFixed(2)+'%';
export default function VbmUpdate(){
 const t=snapshot.totals,b=snapshot.baseline,sent=t.provided.total+t.voted.total;
 return <section className={styles.tableCard} aria-label="October 20 mail and early voting update">
 <div className={styles.tableHead}><div><h2>October 20 mail + early voting update</h2><p>{snapshot.snapshotNotice}</p><p>All 67 county VBM originals and 34 early-voting originals verified. The other 33 counties had not opened early voting for the reported day. Activity through October 19.</p></div></div>
 <div className={styles.cards} style={{gridTemplateColumns:'repeat(3, minmax(0, 1fr))'}}>
 <article><label>Mail returned statewide</label><strong>{n(t.voted.total)}</strong><small>{pct(t.voted.total/sent*100)} of {n(sent)} issued</small></article>
 <article><label>Early in person</label><strong>{n(t.early.total)}</strong><small>Separate early-voting compilation</small></article>
 <article><label>Combined ballots cast</label><strong>{n(t.voted.total+t.early.total)}</strong><small>Mail returned + early in person</small></article>
 </div>
 <div className={styles.tableWrap}><table><thead><tr><th>Party</th><th>VBM issued</th><th>Mail returned</th><th>Return rate</th><th>Outstanding mail</th><th>Early in person</th><th>Combined cast</th><th>Mail change since Oct. 19</th></tr></thead><tbody>{(['dem','rep','npa','other'] as const).map(p=><tr key={p}><td>{p.toUpperCase()}</td><td>{n(t.provided[p]+t.voted[p])}</td><td>{n(t.voted[p])}</td><td>{pct(t.voted[p]/(t.provided[p]+t.voted[p])*100)}</td><td>{n(t.provided[p])}</td><td>{n(t.early[p])}</td><td>{n(t.voted[p]+t.early[p])}</td><td>+{n(t.voted[p]-b[`${p}Returned`])}</td></tr>)}</tbody></table></div>
 <div className={styles.tableHead}><div><p><b>Reporting status:</b> Liberty arrived after the initial morning posting and is included in the verified 11:00 AM VBM archive. Public figures use the 11:01 AM state compilation; early-voting voter records use the separate 8:03 AM archive. Live county feeds remain separately timestamped. No earlier voter records were substituted.</p><p><b>Comparisons:</b> {snapshot.dailyComparisonNote} Earlier missing-county reports and backfills affect statewide changes. District mail changes are available only where county coverage is verified comparable. No verified prior district early-voting baseline is available. Party registration does not indicate candidate choice.</p><p><a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Official Florida data</a> • <a href="/general/districts">All district breakdowns</a></p></div></div>
 </section>;
}
