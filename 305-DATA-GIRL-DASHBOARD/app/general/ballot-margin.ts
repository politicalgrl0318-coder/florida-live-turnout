export type BallotTotals = {dem:number;rep:number;total:number;unallocated?:number};

// Use the same all-party denominator as the selected statewide ballot totals.
export function ballotMargin(values:BallotTotals|null|undefined){
 if(!values||![values.dem,values.rep,values.total].every(v=>Number.isSafeInteger(v)&&v>=0)||values.dem+values.rep>values.total)return null;
 const difference=values.dem-values.rep;
 return {
  difference,
  ballots:Math.abs(difference),
  leader:difference>0?'dem' as const:difference<0?'rep' as const:'even' as const,
  percentagePoints:values.total>0?100*Math.abs(difference)/values.total:null,
 };
}

export function ballotMarginPoints(value:number){
 return value>0&&value<0.01?'<0.01':value.toFixed(2);
}
