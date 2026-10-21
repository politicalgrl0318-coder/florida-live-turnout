export type PartySplit={dem:number;rep:number;npa:number;other:number};
export type TurnoutRow={code:string;name:string;sourceUrl:string;status:"live"|"unavailable";registered:number;ballots:number;turnout:number;mail:number;early:number;electionDay:number;dem:number;rep:number;npa:number;other:number;mailParty:PartySplit;earlyParty:PartySplit;electionDayParty:PartySplit;updated:string|null;electionName:string;electionDate:string;stale?:boolean};
// Validate each county independently; one failed source must not erase the rest.
export function isCurrentGeneral(name:unknown,date:unknown){
  return /general/i.test(String(name))&&/^(?:11\/0?3\/2026|2026-11-03)(?:$|T|\s)/.test(String(date));
}
export function usableCounty(row:TurnoutRow){
  if(!row||typeof row.code!=="string"||!row.code.match(/^[A-Z]{3}$/)) return false;
  if(row.status==="unavailable") return true;
  if(row.status!=="live"||!isCurrentGeneral(row.electionName,row.electionDate)) return false;
  const keys=["mail","early","electionDay","ballots","registered","dem","rep","npa","other"] as const;
  if(keys.some(key=>!Number.isSafeInteger(row[key])||row[key]<0)) return false;
  const methods=[[row.mail,row.mailParty],[row.early,row.earlyParty],[row.electionDay,row.electionDayParty]] as const;
  if(methods.some(([total,split])=>!split||[split.dem,split.rep,split.npa,split.other].some(v=>!Number.isSafeInteger(v)||v<0)||total!==split.dem+split.rep+split.npa+split.other)) return false;
  return row.ballots===row.mail+row.early+row.electionDay&&(["dem","rep","npa","other"] as const).every(p=>row[p]===row.mailParty[p]+row.earlyParty[p]+row.electionDayParty[p]);
}
export function mergeCountyRows(previous:TurnoutRow[],incoming:TurnoutRow[]){
  const rows=new Map(previous.map(row=>[row.code,{...row,stale:row.status==="live"}]));
  for(const row of incoming){
    if(!usableCounty(row)) continue;
    const saved=rows.get(row.code);
    if(saved?.status==="live"){
      if(row.status!=="live") continue;
      const oldTime=Date.parse(saved.updated||""),newTime=Date.parse(row.updated||"");
      if(Number.isFinite(oldTime)&&(!Number.isFinite(newTime)||newTime<oldTime)) continue;
    }
    rows.set(row.code,{...row,stale:false});
  }
  return [...rows.values()];
}
export function vbmOnlySource(row:TurnoutRow){return /\/AbsenteeTurnOut\//i.test(row.sourceUrl)}
