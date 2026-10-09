import styles from './general.module.css';
import history from '../../public/data/general-conversion-history.json';
type Parties={rep:number;dem:number;npa:number;other:number};
type Point={date:string;compiled:string;returned:Parties;requested:Parties};
const parties=['rep','dem','npa','other'] as const;
const registration:Parties={rep:5649410,dem:4098139,npa:3326661,other:505914};
const colors={rep:'#bf3535',dem:'#2167b3',npa:'#596579',other:'#8155a3'};
const total=(x:Parties)=>parties.reduce((a,p)=>a+x[p],0);
const pct=(x:number|null)=>x===null?'—':`${x.toFixed(2)}%`;
const rate=(v:number,d:number)=>d>0?v/d*100:null;
const n=(x:number)=>x.toLocaleString('en-US');
const pp=(x:number|null)=>x===null?'—':`${x>0?'+':''}${x.toFixed(2)} pp`;
const dateOf=(compiled:string)=>{const m=compiled.match(/(\d{2})\/(\d{2})\/(\d{4})/);return m?`${m[3]}-${m[1]}-${m[2]}`:''};
export default function RegistrationComparison({cast,returns,requested,compiled,children}:{cast:Parties;returns:Parties;requested:Parties;compiled:string;children:React.ReactNode}){
 const date=dateOf(compiled);
 const points:Point[]=[...history.filter(x=>x.date<date),{date,compiled,returned:returns,requested}].filter(x=>x.date).sort((a,b)=>a.date.localeCompare(b.date));
 const prior=points.find(x=>Date.parse(date)-Date.parse(x.date)===86400000);
 const registeredTotal=total(registration),returnedTotal=total(returns);
 const maxRate=Math.max(5,...points.flatMap(x=>parties.map(p=>rate(x.returned[p],x.requested[p])||0)));
 const ceiling=Math.ceil(maxRate/5)*5;
 const x=(i:number)=>70+i*700/Math.max(1,points.length-1),y=(v:number)=>225-v/ceiling*180;
 return <section className={`${styles.tableCard} ${styles.participation}`} aria-label="Ballots cast and VBM conversion">
  {children}
  <div className={styles.tableHead}><div><h2>Turnout &amp; returns vs. registration</h2><p>VBM conversion highlights the share of requested / provided ballots already returned. State snapshot: {compiled} ET.</p></div></div>
  <div className={styles.inlineMetrics}><span>Overall turnout <b>{pct(rate(total(cast),registeredTotal))}</b></span><span>VBM conversion <b>{pct(rate(returnedTotal,total(requested)))}</b></span><span>Change since previous day <b>{pp(prior?(rate(returnedTotal,total(requested))||0)-(rate(total(prior.returned),total(prior.requested))||0):null)}</b></span></div>
  <div className={styles.tableWrap}><table><thead><tr><th>Party</th><th className={styles.conversionCell}>VBM conversion</th><th>Change vs. previous day</th><th>VBM requested / provided</th><th>VBM returned</th><th>Ballots cast</th><th>Turnout / registration</th><th>Share of returns</th><th>Registration share</th><th>Share gap</th></tr></thead><tbody>{parties.map(p=>{
   const conversion=rate(returns[p],requested[p]);const previous=prior?rate(prior.returned[p],prior.requested[p]):null;
   const share=rate(returns[p],returnedTotal),regShare=registration[p]/registeredTotal*100;
   return <tr key={p}><td><b style={{color:colors[p]}}>{p.toUpperCase()}</b></td><td className={styles.conversionCell}><b>{pct(conversion)}</b></td><td>{pp(conversion!==null&&previous!==null?conversion-previous:null)}</td><td>{n(requested[p])}</td><td>{n(returns[p])}</td><td>{n(cast[p])}</td><td>{pct(rate(cast[p],registration[p]))}</td><td>{pct(share)}</td><td>{pct(regShare)}</td><td>{pp(share===null?null:share-regShare)}</td></tr>;
  })}</tbody></table></div>
  <div className={styles.conversionChart}><h3>VBM conversion by party</h3><p>Cumulative return rates by reporting day • {prior?`daily changes compare ${prior.compiled} with ${compiled} ET`:'previous-day comparison unavailable'}</p>
  <svg viewBox="0 0 840 285" role="img" aria-label="Line graph of cumulative VBM conversion rates by party"><title>VBM returns divided by requested / provided ballots, by reporting day</title>{Array.from({length:5},(_,i)=>{const v=ceiling*i/4;return <g key={i}><line x1="70" x2="770" y1={y(v)} y2={y(v)} stroke="#ddd7cd"/><text x="55" y={y(v)+4} textAnchor="end">{v.toFixed(1)}%</text></g>})}{points.map((point,i)=><text key={point.date} x={x(i)} y="252" textAnchor="middle">{point.date.slice(5).replace('-','/')}</text>)}{parties.map(p=><g key={p}><polyline fill="none" stroke={colors[p]} strokeWidth="3" points={points.map((point,i)=>{const v=rate(point.returned[p],point.requested[p]);return v===null?'':`${x(i)},${y(v)}`}).join(' ')}/>{points.map((point,i)=>{const v=rate(point.returned[p],point.requested[p]);return v===null?null:<circle key={point.date} cx={x(i)} cy={y(v)} r="5" fill={colors[p]}><title>{point.compiled}: {p.toUpperCase()} {pct(v)} ({n(point.returned[p])} / {n(point.requested[p])})</title></circle>})}</g>)}</svg>
  <div className={styles.chartLegend}>{parties.map(p=><span key={p}><i style={{background:colors[p]}}/>{p.toUpperCase()} <b>{pct(rate(returns[p],requested[p]))}</b> <small>{pp(prior?(rate(returns[p],requested[p]))!-(rate(prior.returned[p],prior.requested[p]))!:null)}</small></span>)}</div></div>
  <p className={styles.registrationNote}>Conversion = VBM returned ÷ (returned + outstanding); this is the reported provided-ballot universe, not unfulfilled requests. Conversion, return shares and graph use the same statewide compilation; ballots cast and overall turnout follow the selected view. Changes compare cumulative snapshots, not ballots received during one day. October 8 history carries Columbia and Liberty forward from October 7; October 9 public totals retain Calhoun’s October 8 statistics. Monroe is current in October 9 totals. <a href="https://dos.fl.gov/elections/data-statistics/voter-registration-statistics/voter-registration-reports/voter-registration-by-county-and-party/" target="_blank" rel="noreferrer">Active registration baseline: August 31, 2026 ↗</a>. Turnout = cast ÷ active registration; share gap = return share − registration share. Party registration does not indicate candidate choice.</p>
 </section>;
}
