import snapshot from '../../public/data/general-official-snapshot.json';
import styles from './general.module.css';
const n=(v:number)=>v.toLocaleString('en-US');
const pct=(v:number)=>v.toFixed(2)+'%';
export default function VbmUpdate(){
 const t=snapshot.totals,b=snapshot.baseline,sent=t.provided.total+t.voted.total,unused=0;
 return <section className={styles.tableCard} aria-label="October 19 VBM update">
 <div className={styles.tableHead}><div><h2>October 19 VBM update</h2><p>{snapshot.snapshotNotice}</p><p>District voter file: October 19, 8:04 AM ET archive, activity through October 18; nine counties absent. District figures remain tied to that package when the live official compilation changes.</p></div></div>
 <div className={styles.cards} style={{gridTemplateColumns:'repeat(2, minmax(0, 1fr))'}}>
 <article><label>Returned statewide</label><strong>{n(t.voted.total)}</strong><small>{pct(t.voted.total/sent*100)} of {n(sent)} provided • +{n(t.voted.total-b.returned)} since October 18</small></article>
 <article><label>D–R return margin</label><strong>D +{n(t.voted.dem-t.voted.rep)}</strong><small>Widened by {n((t.voted.dem-t.voted.rep)-(b.demReturned-b.repReturned))}</small></article>
 </div>
 <div className={styles.tableWrap}><table><thead><tr><th>Party</th><th>Provided statewide</th><th>Returned</th><th>Return rate</th><th>Additional returns since October 18</th><th>Outstanding</th></tr></thead><tbody>{(['dem','rep','npa','other'] as const).map(p=><tr key={p}><td>{p.toUpperCase()}</td><td>{n(t.provided[p]+t.voted[p])}</td><td>{n(t.voted[p])}</td><td>{pct(t.voted[p]/(t.provided[p]+t.voted[p])*100)}</td><td>+{n(t.voted[p]-b[`${p}Returned`])}</td><td>{n(t.provided[p])}</td></tr>)}</tbody></table></div>
 <div className={styles.tableHead}><div><p><b>Reporting status:</b> The public summary includes all 67 counties, but Dixie, Gadsden, Hamilton, Hendry, Levy, Liberty, Martin, St. Lucie and Sumter retain earlier statistics with their actual county timestamps. The district archive contains 58 supplied county datasets and omits these nine counties. No older voter records were substituted. These are reported processing totals; early VBM returns can reflect delivery and reporting timing. They do not measure candidate votes or establish enthusiasm.</p><p><b>Comparisons:</b> Statewide changes compare October 19 and October 18 at 8:04 AM. District changes compare October 19 and October 18 verified sources only where county coverage is comparable. Reported-count changes are not ballots cast in a single day. County-level and district-level snapshots are never substituted for one another. Florida can refresh at noon, 3 PM and 6 PM for late county reporting.</p><p><a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Official Florida data</a> • <a href="/general/districts">All district breakdowns</a></p></div></div>
 </section>;
}
