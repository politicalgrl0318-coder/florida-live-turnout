import snapshot from '../../public/data/general-verified-update.json';
import {PartyBreakdown,n,time,margin} from './turnout-ui';
import ui from './turnout-ui.module.css';
const parties=['dem','rep','npa','other'] as const;
type Counts={total:number;dem:number;rep:number;npa:number;other:number;unallocated:number};
const valid=(row:Counts)=>['total',...parties,'unallocated'].every(key=>Number.isSafeInteger(row[key as keyof Counts])&&row[key as keyof Counts]>=0)&&row.total===row.dem+row.rep+row.npa+row.other+row.unallocated;
export default function VerifiedUpdate(){
 const methods=[snapshot.methods.mail,snapshot.methods.early,snapshot.methods.electionDay];
 if(snapshot.electionNumber!=='49894'||!valid(snapshot.combined)||!methods.every(valid)||['total',...parties,'unallocated'].some(key=>methods.reduce((sum,r)=>sum+r[key as keyof Counts],0)!==snapshot.combined[key as keyof Counts]))return null;
 const rows:[string,Counts][]=[['Combined ballots',snapshot.combined],['Vote-by-mail returns',snapshot.methods.mail],['Early voting',snapshot.methods.early]];
 const changes=snapshot.comparison.reportedChange;
 return <details className={ui.history} style={{marginLeft:0,marginRight:0}} id='verified-update' data-verified-update={snapshot.checkedAt} data-historical-snapshot>
  <summary>Saved snapshot &amp; reporting correction · October 24, 6:17 p.m. EDT</summary>
  <div className={ui.historyContent}><h2>Verified statewide update — historical snapshot</h2><p>This fixed snapshot was verified {time(snapshot.checkedAt)}. It is preserved for reference, not displayed as a second live total. The live cards above use newer verified county methods when available.</p><a href='/data/general-verified-update.json' target='_blank' rel='noreferrer'>Archived data, sources &amp; corrections ↗</a>
   <div className={ui.snapshotMethods}>{rows.map(([label,row])=><section key={label}><h3>{label}</h3><strong>{n(row.total)}</strong><small>{margin(row)} by registered party</small><PartyBreakdown values={row} total={row.total} unallocated={row.unallocated}/></section>)}</div>
   <p>Election Day had not begun; no Election Day ballots are included. The saved selection covers 67 counties, with earlier verified methods retained for Miami-Dade and Glades. Three party classifications are unallocated.</p>
   <p><b>Coverage correction—not an 18,148-vote surge:</b> Broward’s newer county early-voting report replaced a delayed state fallback. Of {n(changes.combined.total)} additional reported ballots versus the {time(snapshot.comparison.previousComparableCheckedAt)} snapshot, {n(snapshot.comparison.browardEarlyFallbackReplacement.total)} reflect that source replacement. The remaining {n(snapshot.comparison.remainingNetReportedChange)} are a net reported change and may include revisions.</p>
   <details><summary>Historical changes and source limitations</summary><div className={ui.archiveChanges}>{([['Mail',changes.mail],['Early voting',changes.early],['Election Day',changes.electionDay],['Combined',changes.combined]] as [string,Counts][]).map(([label,row])=><div key={label}><strong>{label}: +{n(row.total)} reported ballots</strong>DEM +{n(row.dem)} · REP +{n(row.rep)} · NPA +{n(row.npa)} · Other +{n(row.other)} · Unallocated +{n(row.unallocated)}</div>)}</div>{snapshot.exceptions.map(note=><p key={note}>{note}</p>)}<p>Original source timestamps: {time(snapshot.sourceTimestampRange.oldest)} through {time(snapshot.sourceTimestampRange.newest)}.</p></details>
   <p className={ui.footnote}>Do not add this archive to the current selection. Changes are newly reported activity, not necessarily votes physically cast between checks. Party registration is not candidate preference. Provisional ballots are excluded.</p>
  </div>
 </details>;
}
