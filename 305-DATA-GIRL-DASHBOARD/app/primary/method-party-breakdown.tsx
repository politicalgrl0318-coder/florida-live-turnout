"use client";

const number = new Intl.NumberFormat("en-US");
const pct = (v:number) => `${v.toFixed(2)}%`;

type PartySplit = {dem:number;rep:number;npa:number;other:number};
type MethodRow = {
  mailParty?: PartySplit;
  earlyParty?: PartySplit;
  electionDayParty?: PartySplit;
};

const empty = ():PartySplit => ({dem:0,rep:0,npa:0,other:0});
const add = (a:PartySplit,b?:PartySplit):PartySplit => ({
  dem:a.dem+(b?.dem||0),
  rep:a.rep+(b?.rep||0),
  npa:a.npa+(b?.npa||0),
  other:a.other+(b?.other||0),
});

export default function MethodPartyBreakdown({rows}:{rows:any[]}){
  const mail=rows.reduce((a,r:MethodRow)=>add(a,r.mailParty),empty());
  const early=rows.reduce((a,r:MethodRow)=>add(a,r.earlyParty),empty());
  const electionDay=rows.reduce((a,r:MethodRow)=>add(a,r.electionDayParty),empty());
  const methods=[
    {label:"Vote by mail",data:mail},
    {label:"Early voting",data:early},
    {label:"Election Day",data:electionDay},
  ];

  return <section style={{marginTop:22}}>
    <div style={{marginBottom:10}}>
      <h2 style={{margin:"0 0 5px",fontSize:24,letterSpacing:"-.025em"}}>Party breakdown by voting method</h2>
      <p style={{margin:0,color:"var(--muted)",fontSize:13}}>DEM, REP, NPA and Other within vote by mail, early voting and Election Day.</p>
    </div>
    {methods.map(method=>{
      const d=method.data;
      const total=d.dem+d.rep+d.npa+d.other;
      const denom=total||1;
      const margin=d.dem-d.rep;
      return <div key={method.label} style={{marginTop:14}}>
        <h3 style={{margin:"0 0 8px",fontSize:15}}>{method.label} <span style={{color:"var(--muted)",fontWeight:500}}>• {number.format(total)} ballots</span></h3>
        <div className="party-panel" style={{marginTop:0}}>
          <div><span>DEM</span><strong className="dem">{number.format(d.dem)}</strong><small>{pct(d.dem/denom*100)}</small></div>
          <div><span>REP</span><strong className="rep">{number.format(d.rep)}</strong><small>{pct(d.rep/denom*100)}</small></div>
          <div><span>NPA</span><strong>{number.format(d.npa)}</strong><small>{pct(d.npa/denom*100)}</small></div>
          <div><span>OTHER</span><strong>{number.format(d.other)}</strong><small>{pct(d.other/denom*100)}</small></div>
          <div className="margin"><span>D–R MARGIN</span><strong className={margin>=0?"blue":"red"}>{margin>=0?"D":"R"} +{number.format(Math.abs(margin))}</strong><small>{pct(Math.abs(margin)/denom*100)} of method</small></div>
        </div>
      </div>
    })}
  </section>;
}
