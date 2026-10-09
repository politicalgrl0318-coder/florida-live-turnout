import styles from './general.module.css';

type Parties = {rep:number;dem:number;npa:number;other:number};
// Florida DOE active registration, August 31, 2026. Keep the denominator dated.
const registration: Parties = {rep:5649410,dem:4098139,npa:3326661,other:505914};
const registeredTotal = Object.values(registration).reduce((a,b)=>a+b,0);
const source = 'https://dos.fl.gov/elections/data-statistics/voter-registration-statistics/voter-registration-reports/voter-registration-by-county-and-party/';
const n = (value:number)=>value.toLocaleString('en-US');
const pct = (value:number)=>`${value.toFixed(2)}%`;

export default function RegistrationComparison({cast,returns,compiled,label}:{cast:Parties;returns:Parties;compiled:string;label:string}) {
  const castTotal=cast.rep+cast.dem+cast.npa+cast.other;
  const returnsTotal=returns.rep+returns.dem+returns.npa+returns.other;
  return <section className={styles.tableCard} aria-label="Turnout and returns versus registration">
    <div className={styles.tableHead}><div><h2>Turnout &amp; returns vs. registration</h2><p>{label} • State compilation: {compiled} ET. County feeds retain their individual update times.</p></div></div>
    <div className={styles.cards}>
      <article><label>Overall turnout</label><strong>{pct(castTotal/registeredTotal*100)}</strong><small>{n(castTotal)} ballots cast ÷ {n(registeredTotal)} active registered voters</small></article>
      <article><label>VBM turnout</label><strong>{pct(returnsTotal/registeredTotal*100)}</strong><small>{n(returnsTotal)} mail returns ÷ active registered voters</small></article>
    </div>
    <div className={styles.tableWrap}><table><thead><tr><th>Party</th><th>Active registered</th><th>Turnout</th><th>VBM returned</th><th>VBM turnout</th><th>Share of returns</th><th>Registration share</th><th>Return share − registration share</th></tr></thead><tbody>
      {(['rep','dem','npa','other'] as const).map(p=>{
        const regShare=registration[p]/registeredTotal*100;
        const returnShare=returnsTotal?returns[p]/returnsTotal*100:null;
        const gap=returnShare===null?null:returnShare-regShare;
        return <tr key={p}><td><b>{p.toUpperCase()}</b></td><td>{n(registration[p])}</td><td>{pct(cast[p]/registration[p]*100)}</td><td>{n(returns[p])}</td><td>{pct(returns[p]/registration[p]*100)}</td><td>{returnShare===null?'—':pct(returnShare)}</td><td>{pct(regShare)}</td><td>{gap===null?'—':`${gap>0?'+':''}${gap.toFixed(2)} pp`}</td></tr>;
      })}
    </tbody></table></div>
    <p className={styles.registrationNote}><a href={source} target="_blank" rel="noreferrer">Registration baseline: Florida DOE, August 31, 2026 ↗</a>. Active registration is a fixed, dated comparison baseline, not the final November electorate. Turnout = ballots cast ÷ registered voters; VBM turnout = mail returns ÷ registered voters. Share gap is measured in percentage points; positive means a larger share of returns than registration. This differs from the VBM return rate (returns ÷ ballots sent). OTHER combines minor parties. Party identifies voter registration, not candidate choice.</p>
  </section>;
}
