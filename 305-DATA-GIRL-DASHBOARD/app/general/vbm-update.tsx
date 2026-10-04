import snapshot from '../../public/data/general-official-snapshot.json';
import styles from './general.module.css';
const n=(v:number)=>v.toLocaleString('en-US');
const pct=(v:number)=>v.toFixed(2)+'%';
export default function VbmUpdate(){
 const t=snapshot.totals,b=snapshot.baseline,sent=t.provided.total+t.voted.total,dade=snapshot.counties.find(c=>c.code==='DAD')!;
 return <section className={styles.tableCard} aria-label="October 3 VBM update">
 <div className={styles.tableHead}><div><h2>October 3 VBM update</h2><p>{snapshot.snapshotNotice}</p><p>District voter file: October 3 package, activity through October 2. District figures remain tied to that package when the live official compilation changes.</p></div></div>
 <div className={styles.cards}>
 <article><label>Returned statewide</label><strong>{n(t.voted.total)}</strong><small>{pct(t.voted.total/sent*100)} of {n(sent)} provided • +{n(t.voted.total-b.returned)} since Oct. 2</small></article>
 <article><label>D–R return margin</label><strong>D +{n(t.voted.dem-t.voted.rep)}</strong><small>Widened by {n((t.voted.dem-t.voted.rep)-(b.demReturned-b.repReturned))}</small></article>
 <article><label>Miami-Dade returned</label><strong>{n(dade.voted.total)}</strong><small>{pct(dade.voted.total/(dade.provided.total+dade.voted.total)*100)} • +3,006 since Oct. 2</small></article>
 <article><label>Miami-Dade margin</label><strong>D +{n(dade.voted.dem-dade.voted.rep)}</strong><small>Widened by 268 • {n(dade.provided.total+dade.voted.total)} provided</small></article>
 </div>
 <div className={styles.tableWrap}><table><thead><tr><th>Party</th><th>Provided statewide</th><th>Returned</th><th>Return rate</th><th>Additional returns</th><th>Miami-Dade returns</th></tr></thead><tbody>{(['dem','rep','npa','other'] as const).map(p=><tr key={p}><td>{p.toUpperCase()}</td><td>{n(t.provided[p]+t.voted[p])}</td><td>{n(t.voted[p])}</td><td>{pct(t.voted[p]/(t.provided[p]+t.voted[p])*100)}</td><td>+{n(t.voted[p]-b[`${p}Returned`])}</td><td>{n(dade.voted[p])}</td></tr>)}</tbody></table></div>
 <div className={styles.tableHead}><div><p><b>Reporting status:</b> Baker, Gulf, Lafayette and Liberty report zero returns; Jackson reports one. Pinellas reports 536 / 205,072 provided (0.26%), while Pasco reports 6,357 / 51,903 (12.25%). These are reported processing totals; early district rankings can reflect delivery and reporting timing. They do not measure candidate votes or establish enthusiasm.</p><p><b>Comparisons:</b> Statewide changes use the official October 2 aggregate. District changes use the October 2 voter file, which has one fewer statewide V record than that official aggregate. County-level and district-level snapshots are never substituted for one another. Florida can refresh at noon, 3 PM and 6 PM for late county reporting.</p><p><a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Official Florida data</a> • <a href="/general/districts">All district breakdowns and rankings</a></p></div></div>
 </section>;
}
