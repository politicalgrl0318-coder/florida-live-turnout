import snapshot from '../../public/data/general-official-snapshot.json';
import styles from './general.module.css';
const n=(v:number)=>v.toLocaleString('en-US');
const pct=(v:number)=>v.toFixed(2)+'%';
export default function VbmUpdate(){
 const t=snapshot.totals,b=snapshot.baseline,sent=t.provided.total+t.voted.total,dade=snapshot.counties.find(c=>c.code==='DAD')!;
 return <section className={styles.tableCard} aria-label="October 9 VBM update">
 <div className={styles.tableHead}><div><h2>October 9 VBM update</h2><p>{snapshot.snapshotNotice}</p><p>District voter file: October 9, 11:01 AM ET archive, activity through October 8; Monroe included, Calhoun absent. District figures remain tied to that package when the live official compilation changes.</p></div></div>
 <div className={styles.cards} style={{gridTemplateColumns:'repeat(2, minmax(0, 1fr))'}}>
 <article><label>Returned statewide</label><strong>{n(t.voted.total)}</strong><small>{pct(t.voted.total/sent*100)} of {n(sent)} provided • +{n(t.voted.total-b.returned)} since Oct. 8</small></article>
 <article><label>D–R return margin</label><strong>D +{n(t.voted.dem-t.voted.rep)}</strong><small>Widened by {n((t.voted.dem-t.voted.rep)-(b.demReturned-b.repReturned))}</small></article>
 </div>
 <div className={styles.tableWrap}><table><thead><tr><th>Party</th><th>Provided statewide</th><th>Returned</th><th>Return rate</th><th>Additional returns since Oct. 8</th><th>Miami-Dade returns</th></tr></thead><tbody>{(['dem','rep','npa','other'] as const).map(p=><tr key={p}><td>{p.toUpperCase()}</td><td>{n(t.provided[p]+t.voted[p])}</td><td>{n(t.voted[p])}</td><td>{pct(t.voted[p]/(t.provided[p]+t.voted[p])*100)}</td><td>+{n(t.voted[p]-b[`${p}Returned`])}</td><td>{n(dade.voted[p])}</td></tr>)}</tbody></table></div>
 <div className={styles.tableHead}><div><p><b>Reporting status:</b> The public summary shows all 67 counties: 66 are current, including Monroe; Calhoun retains October 8 statistics. The district archive contains 66 counties and omits Calhoun. These are reported processing totals; early VBM returns can reflect delivery and reporting timing. They do not measure candidate votes or establish enthusiasm.</p><p><b>Comparisons:</b> Statewide changes compare the October 9 public compilation with October 8. District changes compare the October 9 archive with the verified October 8 county-source snapshot. Daily changes are unavailable for districts affected by missing Calhoun data. County-level and district-level snapshots are never substituted for one another. Florida can refresh at noon, 3 PM and 6 PM for late county reporting.</p><p><a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Official Florida data</a> • <a href="/general/districts">All district breakdowns</a></p></div></div>
 </section>;
}
