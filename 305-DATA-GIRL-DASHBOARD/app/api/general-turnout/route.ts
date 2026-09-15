import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const counties: Record<string,string> = {
  ALA:"Alachua",BAK:"Baker",BAY:"Bay",BRA:"Bradford",BRE:"Brevard",BRO:"Broward",CAL:"Calhoun",CHA:"Charlotte",CIT:"Citrus",CLA:"Clay",CLL:"Collier",CLM:"Columbia",DAD:"Miami-Dade",DES:"DeSoto",DIX:"Dixie",DUV:"Duval",ESC:"Escambia",FLA:"Flagler",FRA:"Franklin",GAD:"Gadsden",GIL:"Gilchrist",GLA:"Glades",GUL:"Gulf",HAM:"Hamilton",HAR:"Hardee",HEN:"Hendry",HER:"Hernando",HIG:"Highlands",HIL:"Hillsborough",HOL:"Holmes",IND:"Indian River",JAC:"Jackson",JEF:"Jefferson",LAF:"Lafayette",LAK:"Lake",LEE:"Lee",LEO:"Leon",LEV:"Levy",LIB:"Liberty",MAD:"Madison",MAN:"Manatee",MRN:"Marion",MRT:"Martin",MON:"Monroe",NAS:"Nassau",OKA:"Okaloosa",OKE:"Okeechobee",ORA:"Orange",OSC:"Osceola",PAL:"Palm Beach",PAS:"Pasco",PIN:"Pinellas",POL:"Polk",PUT:"Putnam",STJ:"St. Johns",STL:"St. Lucie",SAN:"Santa Rosa",SAR:"Sarasota",SEM:"Seminole",SUM:"Sumter",SUW:"Suwannee",TAY:"Taylor",UNI:"Union",VOL:"Volusia",WAK:"Wakulla",WAL:"Walton",WAS:"Washington"
};

const base = "https://s3.us-east-1.amazonaws.com/turnoutquickview.electionsfl.org/data/FL";
const source = (code:string) => `https://tqv.vrswebapps.com/?state=FL&county=${code.toLowerCase()}`;
const BATCH_SIZE = 15;
const sum = (obj:Record<string,number>|undefined) => Object.values(obj||{}).reduce((a,b)=>a+(Number(b)||0),0);
const emptyMethod = () => ({dem:0,rep:0,npa:0,other:0});

function isGeneralElection(summary:any){
  const name=String(summary?.ElectionName||"").toLowerCase();
  const date=String(summary?.ElectionDate||"").replaceAll("-","/");
  return name.includes("general") && /11\/0?3\/2026/.test(date);
}

async function county(code:string,name:string){
  try{
    const indexResponse=await fetch(`${base}/${code}/index.json?${Date.now()}`,{cache:"no-store"});
    if(!indexResponse.ok) throw new Error("index unavailable");
    const elections=await indexResponse.json() as (string|number)[];
    const candidates=[...elections].sort((a,b)=>Number(b)-Number(a));
    let j:any=null;
    for(const election of candidates){
      const r=await fetch(`${base}/${code}/${election}/data.json?${Date.now()}`,{cache:"no-store"});
      if(!r.ok) continue;
      const candidate=await r.json() as any;
      if(isGeneralElection(candidate?.Summary)){j=candidate;break;}
    }
    if(!j) throw new Error("2026 general election not published");

    const p=j.Turnout?.PartyType||{};
    const days=Object.values(j.Turnout?.DateType||{}) as Record<string,number>[];
    const mail=days.reduce((a,d)=>a+(Number(d.Mail)||0),0);
    const early=days.reduce((a,d)=>a+(Number(d.EarlyVoting)||0),0);
    const electionDay=days.reduce((a,d)=>a+(Number(d.ElectionDay)||0),0);
    const dem=sum(p.DEM),rep=sum(p.REP),npa=sum(p.NPA);
    const all=Object.values(p).reduce((a,v)=>a+sum(v as Record<string,number>),0);
    const other=Math.max(0,all-dem-rep-npa);
    const ballots=mail+early+electionDay;
    const registered=Number(j.Summary?.ActiveEligibleVoters||j.Summary?.TotalRegisteredVoters||0);
    const value=(party:string,key:string)=>Number(p?.[party]?.[key]||0);
    const allFor=(key:string)=>Object.values(p).reduce((a,v)=>a+Number((v as Record<string,number>)?.[key]||0),0);
    const methodParty=(key:string)=>{
      const dem=value("DEM",key),rep=value("REP",key),npa=value("NPA",key);
      return {dem,rep,npa,other:Math.max(0,allFor(key)-dem-rep-npa)};
    };

    return {
      code,name,sourceUrl:source(code),status:"live" as const,registered,ballots,
      turnout:registered?ballots/registered*100:0,mail,early,electionDay,dem,rep,npa,other,
      mailParty:methodParty("Mail"),earlyParty:methodParty("EarlyVoting"),electionDayParty:methodParty("ElectionDay"),
      updated:j.Summary?.LastUpdatedTime||null,electionName:j.Summary?.ElectionName||"2026 General Election",electionDate:j.Summary?.ElectionDate||"11/03/2026"
    };
  }catch{
    return {code,name,sourceUrl:source(code),status:"unavailable" as const,registered:0,ballots:0,turnout:0,mail:0,early:0,electionDay:0,dem:0,rep:0,npa:0,other:0,mailParty:emptyMethod(),earlyParty:emptyMethod(),electionDayParty:emptyMethod(),updated:null,electionName:"",electionDate:""};
  }
}

export async function GET(request:NextRequest){
  const batchRaw=Number(request.nextUrl.searchParams.get("batch")||0);
  const batch=Number.isFinite(batchRaw)?Math.max(0,Math.floor(batchRaw)):0;
  const entries=Object.entries(counties).slice(batch*BATCH_SIZE,(batch+1)*BATCH_SIZE);
  const rows=await Promise.all(entries.map(([code,name])=>county(code,name)));
  const first=rows.find(r=>r.status==="live");
  return NextResponse.json({generatedAt:new Date().toISOString(),electionName:first?.electionName||"2026 General Election",electionDate:first?.electionDate||"11/03/2026",counties:rows},{headers:{"Cache-Control":"public, max-age=60, s-maxage=180, stale-while-revalidate=300"}});
}
