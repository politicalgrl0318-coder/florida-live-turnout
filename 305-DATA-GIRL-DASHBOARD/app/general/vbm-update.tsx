import snapshot from '../../public/data/general-official-snapshot.json';
import styles from './general.module.css';
const n=(v:number)=>v.toLocaleString('en-US');
const pct=(v:number)=>v.toFixed(2)+'%';
export default function VbmUpdate(){
 const t=snapshot.totals,b=snapshot.baseline,sent=t.provided.total+t.voted.total,unused=0;
 return <section className={styles.tableCard} aria-label="October 14 VBM update">
 <div className={styles.tableHead}><div><h2>October 14 VBM update</h2><p>{snapshot.snapshotNotice}</p><p>District voter file: October 14, 8:04 AM ET archive, activity through October 13; Suwannee absent. District figures remain tied to that package when the live official compilation changes.</p></div></div>
 <div className={styles.cards} style={{gridTemplateColumns:'repeat(2, minmax(0, 1fr))'}}>
 <article><label>Returned statewide</label><strong>{n(t.voted.total)}</strong><small>{pct(t.voted.total/sent*100)} of {n(sent)} provided • +{n(t.voted.total-b.returned)} since October 13</small></article>
 <article><label>D–R return margin</label><strong>D +{n(t.voted.dem-t.voted.rep)}</strong><small>Widened by {n((t.voted.dem-t.voted.rep)-(b.demReturned-b.repReturned))}</small></article>
 </div>
 <div className={styles.tableWrap}><table><thead><tr><th>Party</th><th>Provided statewide</th><th>Returned</th><th>Return rate</th><th>Additional returns since October 13</th><th>Outstanding</th></tr></thead><tbody>{(['dem','rep','npa','other'] as const).map(p=><tr key={p}><td>{p.toUpperCase()}</td><td>{n(t.provided[p]+t.voted[p])}</td><td>{n(t.voted[p])}</td><td>{pct(t.voted[p]/(t.provided[p]+t.voted[p])*100)}</td><td>+{n(t.voted[p]-b[`${p}Returned`])}</td><td>{n(t.provided[p])}</td></tr>)}</tbody></table></div>
 <div className={styles.tableHead}><div><p><b>Reporting status:</b> The public summary shows all 67 counties: 66 are current; Suwannee retains October 13 statistics. The district archive contains 66 counties and omits Suwannee. These are reported processing totals; early VBM returns can reflect delivery and reporting timing. They do not measure candidate votes or establish enthusiasm.</p><p><b>Comparisons:</b> Statewide changes compare October 14 with October 13. District changes compare verified October 14 and October 13 voter-level files, and are unavailable where county coverage differs. Reported-count changes are not ballots cast in a single day. County-level and district-level snapshots are never substituted for one another. Florida can refresh at noon, 3 PM and 6 PM for late county reporting.</p><p><a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Official Florida data</a> • <a href="/general/districts">All district breakdowns</a></p></div></div>
 </section>;
}
