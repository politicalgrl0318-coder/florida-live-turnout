import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const counties: Record<string, string> = {
  ALA:"Alachua",BAK:"Baker",BAY:"Bay",BRA:"Bradford",BRE:"Brevard",BRO:"Broward",CAL:"Calhoun",CHA:"Charlotte",CIT:"Citrus",CLA:"Clay",CLL:"Collier",CLM:"Columbia",DAD:"Miami-Dade",DES:"DeSoto",DIX:"Dixie",DUV:"Duval",ESC:"Escambia",FLA:"Flagler",FRA:"Franklin",GAD:"Gadsden",GIL:"Gilchrist",GLA:"Glades",GUL:"Gulf",HAM:"Hamilton",HAR:"Hardee",HEN:"Hendry",HER:"Hernando",HIG:"Highlands",HIL:"Hillsborough",HOL:"Holmes",IND:"Indian River",JAC:"Jackson",JEF:"Jefferson",LAF:"Lafayette",LAK:"Lake",LEE:"Lee",LEO:"Leon",LEV:"Levy",LIB:"Liberty",MAD:"Madison",MAN:"Manatee",MRN:"Marion",MRT:"Martin",MON:"Monroe",NAS:"Nassau",OKA:"Okaloosa",OKE:"Okeechobee",ORA:"Orange",OSC:"Osceola",PAL:"Palm Beach",PAS:"Pasco",PIN:"Pinellas",POL:"Polk",PUT:"Putnam",STJ:"St. Johns",STL:"St. Lucie",SAN:"Santa Rosa",SAR:"Sarasota",SEM:"Seminole",SUM:"Sumter",SUW:"Suwannee",TAY:"Taylor",UNI:"Union",VOL:"Volusia",WAK:"Wakulla",WAL:"Walton",WAS:"Washington"
};

const base = "https://s3.us-east-1.amazonaws.com/turnoutquickview.electionsfl.org/data/FL";
const source = (code: string) => `https://tqv.vrswebapps.com/?state=FL&county=${code.toLowerCase()}`;
const sum = (obj: Record<string, number> | undefined) => Object.values(obj || {}).reduce((a,b)=>a+(Number(b)||0),0);
const emptyMethodParty = () => ({dem:0,rep:0,npa:0,other:0});

async function browardCounty(){
  const sourceUrl = "https://updates.electionlink.net/widgets/browardfl/2026-08-18/VoteTypeByLocationTable.html";
  const feedUrl = "https://updates.electionlink.net/widgets/browardfl/2026-08-18/VoteTypeByPartyTable.html";
  const response = await fetch(feedUrl+"?"+Date.now(),{cache:"no-store"});
  if(!response.ok) throw new Error("Broward feed unavailable");
  const html = await response.text();
  if(!html.includes("AUGUST PRIMARY ELECTION")) throw new Error("Broward election mismatch");

  const row=(party:string)=>{
    const pattern=new RegExp(">"+party+"<\\/div><\\/td><td><div[^>]*>([\\d,]+)<\\/div><\\/td><td><div[^>]*>([\\d,]+)<\\/div><\\/td><td><div[^>]*>([\\d,]+)<","i");
    const match=html.match(pattern);
    if(!match) throw new Error("Missing Broward "+party+" row");
    return match.slice(1).map(value=>Number(value.replaceAll(",","")));
  };

  const demTypes=row("Democrat"), repTypes=row("Republican"), npaTypes=row("No Party Affiliation"), otherTypes=row("Other");
  const total=(values:number[])=>values.reduce((a,b)=>a+b,0);
  const dem=total(demTypes), rep=total(repTypes), npa=total(npaTypes), other=total(otherTypes);
  const mailParty={dem:demTypes[0]||0,rep:repTypes[0]||0,npa:npaTypes[0]||0,other:otherTypes[0]||0};
  const earlyParty={dem:demTypes[1]||0,rep:repTypes[1]||0,npa:npaTypes[1]||0,other:otherTypes[1]||0};
  const electionDayParty={dem:demTypes[2]||0,rep:repTypes[2]||0,npa:npaTypes[2]||0,other:otherTypes[2]||0};
  const mail=Object.values(mailParty).reduce((a,b)=>a+b,0);
  const early=Object.values(earlyParty).reduce((a,b)=>a+b,0);
  const electionDay=Object.values(electionDayParty).reduce((a,b)=>a+b,0);
  const ballots=dem+rep+npa+other;
  const eligibleMatch=html.match(new RegExp("ELIGIBLE VOTERS[\\s\\S]{0,100}<font size=4>([\\d,]+)<\\/font>","i"));
  const updatedMatch=html.match(new RegExp("<td[^>]*>([A-Z][a-z]{2} [A-Z][a-z]{2} \\d{1,2} \\d{2}:\\d{2} [AP]M)<\\/td>"));
  const registered=eligibleMatch?Number(eligibleMatch[1].replaceAll(",","")):1358285;
  const updated=updatedMatch?new Date(updatedMatch[1]+" EDT").toISOString():new Date().toISOString();

  return {code:"BRO",name:"Broward",sourceUrl,status:"live",registered,ballots,turnout:registered?ballots/registered*100:0,mail,early,electionDay,dem,rep,npa,other,mailParty,earlyParty,electionDayParty,updated,electionName:"2026 Primary Election",electionDate:"08/18/2026"};
}

async function county(code:string,name:string){
  try{
    const ir=await fetch(`${base}/${code}/index.json?${Date.now()}`,{cache:"no-store"});
    if(!ir.ok) throw new Error();
    const elections=await ir.json() as (string|number)[];
    const election=[...elections].sort()[0];
    const r=await fetch(`${base}/${code}/${election}/data.json?${Date.now()}`,{cache:"no-store"});
    if(!r.ok) throw new Error();
    const j=await r.json() as any;
    const p=j.Turnout?.PartyType||{};
    const days=Object.values(j.Turnout?.DateType||{}) as Record<string,number>[];
    const mail=days.reduce((a,d)=>a+(d.Mail||0),0);
    const early=days.reduce((a,d)=>a+(d.EarlyVoting||0),0);
    const electionDay=days.reduce((a,d)=>a+(d.ElectionDay||0),0);
    const dem=sum(p.DEM), rep=sum(p.REP), npa=sum(p.NPA);
    const all=Object.values(p).reduce((a,v)=>a+sum(v as Record<string,number>),0);
    const other=Math.max(0,all-dem-rep-npa);
    const value=(party:string,key:string)=>Number(p?.[party]?.[key]||0);
    const allFor=(key:string)=>Object.values(p).reduce((a,v)=>a+Number((v as Record<string,number>)?.[key]||0),0);
    const methodParty=(key:string)=>{
      const dem=value("DEM",key),rep=value("REP",key),npa=value("NPA",key);
      return {dem,rep,npa,other:Math.max(0,allFor(key)-dem-rep-npa)};
    };
    const mailParty=methodParty("Mail");
    const earlyParty=methodParty("EarlyVoting");
    const electionDayParty=methodParty("ElectionDay");
    const ballots=mail+early+electionDay;
    const registered=Number(j.Summary?.ActiveEligibleVoters||j.Summary?.TotalRegisteredVoters||0);
    return {code,name,sourceUrl:source(code),status:"live",registered,ballots,turnout:registered?ballots/registered*100:0,mail,early,electionDay,dem,rep,npa,other,mailParty,earlyParty,electionDayParty,updated:j.Summary?.LastUpdatedTime||null,electionName:j.Summary?.ElectionName||"",electionDate:j.Summary?.ElectionDate||""};
  }catch{
    return {code,name,sourceUrl:source(code),status:"unavailable",registered:0,ballots:0,turnout:0,mail:0,early:0,electionDay:0,dem:0,rep:0,npa:0,other:0,mailParty:emptyMethodParty(),earlyParty:emptyMethodParty(),electionDayParty:emptyMethodParty(),updated:null,electionName:"",electionDate:""};
  }
}

export async function GET(){
  const rows=await Promise.all(Object.entries(counties).map(([c,n])=>c==="BRO"?browardCounty().catch(()=>county(c,n)):county(c,n)));
  const first=rows.find(r=>r.status==="live");
  return NextResponse.json({generatedAt:new Date().toISOString(),electionName:first?.electionName||"2026 Primary Election",electionDate:first?.electionDate||"08/18/2026",counties:rows},{headers:{"Cache-Control":"no-store, no-cache, must-revalidate, max-age=0","CDN-Cache-Control":"no-store","Cloudflare-CDN-Cache-Control":"no-store","Pragma":"no-cache","Expires":"0"}});
}
