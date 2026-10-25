import {ballotMargin,ballotMarginPoints,type BallotTotals} from './ballot-margin';
import styles from './statewide-margin.module.css';

type MarginMethod={id:string;label:string;values:BallotTotals;pending?:boolean;notBegun?:boolean};
type Props={
 values:BallotTotals;
 methods:MarginMethod[];
 source:'county'|'state';
 pending?:boolean;
 coverage:string;
 sourceNote:string;
 adjustmentNote?:string;
};
const number=(value:number)=>new Intl.NumberFormat('en-US').format(value);
function label(result:NonNullable<ReturnType<typeof ballotMargin>>){
 return result.leader==='even'?'Even — 0 ballots':`${result.leader==='dem'?'D':'R'} +${number(result.ballots)}`;
}

export default function StatewideMargin({values,methods,source,pending=false,coverage,sourceNote,adjustmentNote}:Props){
 const result=pending?null:ballotMargin(values);
 const hasBallots=!!result&&result.percentagePoints!==null;
 const leader=hasBallots?result.leader:'unavailable';
 const heading=`${source}-statewide-margin-title`;
 return <section className={styles.panel} data-statewide-margin={source} data-leader={leader} data-margin={result?.difference??''} data-total={result?values.total:''} data-dem={result?values.dem:''} data-rep={result?values.rep:''} aria-labelledby={heading}>
  <div className={styles.heading}><h2 id={heading}>Statewide D–R margin</h2><span>{source==='county'?'County turnout':'State benchmark'}</span></div>
  <div className={styles.headline} aria-live='polite' aria-atomic='true'>
   <div><strong className={styles.margin}>{!result?'Margin unavailable':!hasBallots?'No ballots reported':label(result)}</strong><p className={styles.leader}>{!result?'Waiting for reconciled totals':!hasBallots?'No reported ballots in this snapshot':result.leader==='even'?'Democratic and Republican ballot counts are equal':`${result.leader==='dem'?'Democrats':'Republicans'} lead in reported ballots`}</p></div>
   {hasBallots&&<div className={styles.points}><strong>{ballotMarginPoints(result.percentagePoints!)}</strong><span>percentage points</span><small>Difference in share of all reported ballots</small></div>}
  </div>
  <p className={styles.coverage}>{coverage}</p>
  <div className={styles.methods} aria-label='D–R margins by voting method'>{methods.map(method=>{
   const m=method.pending||method.notBegun?null:ballotMargin(method.values);
   const reported=!!m&&m.percentagePoints!==null;
   return <div key={method.id} data-margin-method={method.id} data-leader={reported?m.leader:'unavailable'} data-margin={m?.difference??''}>
    <span>{method.label}</span><strong>{method.notBegun?'Not begun':!m?'Unavailable':!reported?'No ballots reported':label(m)}</strong>
    {reported&&<small>{ballotMarginPoints(m.percentagePoints!)} percentage points</small>}
   </div>;
  })}</div>
  <div className={styles.notes}><p>{sourceNote}</p><p>Ballots by voter registration. This is not a candidate vote margin or a turnout-rate gap.</p>{!pending&&!!values.unallocated&&<p>{number(values.unallocated)} ballots have no party classification and remain in the total.</p>}{adjustmentNote&&<p>{adjustmentNote}</p>}</div>
 </section>;
}
