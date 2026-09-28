import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const counties: Record<string,string> = {
  ALA:"Alachua",BAK:"Baker",BAY:"Bay",BRA:"Bradford",BRE:"Brevard",BRO:"Broward",CAL:"Calhoun",CHA:"Charlotte",CIT:"Citrus",CLA:"Clay",CLL:"Collier",CLM:"Columbia",DAD:"Miami-Dade",DES:"DeSoto",DIX:"Dixie",DUV:"Duval",ESC:"Escambia",FLA:"Flagler",FRA:"Franklin",GAD:"Gadsden",GIL:"Gilchrist",GLA:"Glades",GUL:"Gulf",HAM:"Hamilton",HAR:"Hardee",HEN:"Hendry",HER:"Hernando",HIG:"Highlands",HIL:"Hillsborough",HOL:"Holmes",IND:"Indian River",JAC:"Jackson",JEF:"Jefferson",LAF:"Lafayette",LAK:"Lake",LEE:"Lee",LEO:"Leon",LEV:"Levy",LIB:"Liberty",MAD:"Madison",MAN:"Manatee",MRN:"Marion",MRT:"Martin",MON:"Monroe",NAS:"Nassau",OKA:"Okaloosa",OKE:"Okeechobee",ORA:"Orange",OSC:"Osceola",PAL:"Palm Beach",PAS:"Pasco",PIN:"Pinellas",POL:"Polk",PUT:"Putnam",STJ:"St. Johns",STL:"St. Lucie",SAN:"Santa Rosa",SAR:"Sarasota",SEM:"Seminole",SUM:"Sumter",SUW:"Suwannee",TAY:"Taylor",UNI:"Union",VOL:"Volusia",WAK:"Wakulla",WAL:"Walton",WAS:"Washington"
};

const base = "https://s3.us-east-1.amazonaws.com/turnoutquickview.electionsfl.org/data/FL";
const source = (code:string) => `https://tqv.vrswebapps.com/?state=FL&county=${code.toLowerCase()}`;
const browardResultsPage = "https://browardvotes.gov/results-information";
const browardVbmDashboard = "https://my.browardvotes.gov/TEDElectionLink/AbsenteeTurnOut/dashboard/view/absturnout-race";
const browardPartyDashboard = "https://my.browardvotes.gov/TEDElectionLink/AbsenteeTurnOut/dashboard/view/absturnout-party";
const browardPrecinctCsv = "https://updates.electionlink.net/widgets/browardfl/2026-11-03/TurnoutByPrecinctTable.csv";
const BATCH_SIZE = 15;
const generalElectionCache=new Map<string,{expires:number;promise:Promise<any>}>();
const sum = (obj:Record<string,number>|undefined) => Object.values(obj||{}).reduce((a,b)=>a+(Number(b)||0),0);
const emptyMethod = () => ({dem:0,rep:0,npa:0,other:0});

function isGeneralElection(summary:any){
  const name=String(summary?.ElectionName||"").toLowerCase();
  const date=String(summary?.ElectionDate||"").replaceAll("-","/");
  return name.includes("general") && /11\/0?3\/2026/.test(date);
}

async function generalElectionData(code:string){
  const now=Date.now();
  const cached=generalElectionCache.get(code);
  if(cached&&cached.expires>now) return cached.promise;
  const edgeCache={cf:{cacheTtl:120,cacheEverything:true}} as RequestInit;
  const promise=(async()=>{
    const indexResponse=await fetch(`${base}/${code}/index.json`,edgeCache);
    if(!indexResponse.ok) throw new Error("index unavailable");
    const elections=await indexResponse.json() as (string|number)[];
    const candidates=[...elections].sort((a,b)=>Number(b)-Number(a));
    for(const election of candidates){
      const response=await fetch(`${base}/${code}/${election}/data.json`,edgeCache);
      if(!response.ok) continue;
      const candidate=await response.json() as any;
      if(isGeneralElection(candidate?.Summary)) return candidate;
    }
    throw new Error("2026 general election not published");
  })();
  generalElectionCache.set(code,{expires:now+120000,promise});
  try{return await promise;}catch(error){generalElectionCache.delete(code);throw error;}
}

function precinctActivity(data:any){
  type Precinct={precinct:string;location:string;address:string;eligible:number;mail:number;early:number;electionDay:number;ballots:number;turnout:number};
  const totals=data?.Turnout?.PrecinctType||{};
  const splits=data?.PrecinctSplit||{};
  const locations=data?.Location?.ElectionDay||{};
  const aggregated=new Map<string,Precinct>();

  for(const [splitKey,value] of Object.entries(totals) as [string,any][]){
    const baseKey=splitKey.split(".")[0];
    const meta=splits[splitKey]||splits[baseKey]||{};
    const precinct=String(meta.Precinct||baseKey||splitKey);
    const locationInfo=locations[String(meta.Location||"")]||{};
    const ballotTypes=value?.BallotTypeTotals||{};
    const mail=Number(ballotTypes.Mail||0);
    const early=Number(ballotTypes.EarlyVoting||0);
    const electionDay=Number(ballotTypes.ElectionDay||0);
    const eligible=Number(value?.EligibleVoters||0);
    const existing=aggregated.get(precinct)||{precinct,location:String(locationInfo.Name||""),address:String(locationInfo.Address||""),eligible:0,mail:0,early:0,electionDay:0,ballots:0,turnout:0};
    existing.eligible+=eligible;
    existing.mail+=mail;
    existing.early+=early;
    existing.electionDay+=electionDay;
    existing.ballots+=mail+early+electionDay;
    if(!existing.location&&locationInfo.Name) existing.location=String(locationInfo.Name);
    if(!existing.address&&locationInfo.Address) existing.address=String(locationInfo.Address);
    aggregated.set(precinct,existing);
  }

  return [...aggregated.values()]
    .map(row=>({...row,turnout:row.eligible?row.ballots/row.eligible*100:0}))
    .filter(row=>row.ballots>0)
    .sort((a,b)=>b.ballots-a.ballots||a.precinct.localeCompare(b.precinct,undefined,{numeric:true}));
}

function csvRows(csv:string){
  return csv.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean).map(line=>{
    const cells:string[]=[];
    let value="",quoted=false;
    for(let index=0;index<line.length;index++){
      const character=line[index];
      if(character==='"'&&quoted&&line[index+1]==='"'){value+='"';index++;}
      else if(character==='"') quoted=!quoted;
      else if(character===","&&!quoted){cells.push(value.trim());value="";}
      else value+=character;
    }
    cells.push(value.trim());
    return cells;
  });
}

function browardUpdated(csv:string){
  return csvRows(csv)[0]?.join(",").match(/AS OF\s+(.+)$/i)?.[1]||null;
}

function browardPrecinctRows(csv:string){
  const rows=csvRows(csv);
  const header=rows.findIndex(row=>row[0]?.toLowerCase()==="precinct");
  if(header<0) return [];
  return rows.slice(header+1).map(row=>{
    const eligible=Number((row[1]||"").replaceAll(",",""))||0;
    const mail=Number((row[2]||"").replaceAll(",",""))||0;
    const early=Number((row[3]||"").replaceAll(",",""))||0;
    const electionDay=Number((row[4]||"").replaceAll(",",""))||0;
    const ballots=mail+early+electionDay;
    return {precinct:row[0]||"",location:"",address:"",eligible,mail,early,electionDay,ballots,turnout:eligible?ballots/eligible*100:0};
  }).filter(row=>row.precinct&&row.ballots>0).sort((a,b)=>b.ballots-a.ballots||a.precinct.localeCompare(b.precinct,undefined,{numeric:true}));
}

async function browardCsv(url:string){
  const response=await fetch(url,{cache:"no-store",headers:{Accept:"text/csv,text/plain;q=0.9,*/*;q=0.8"}});
  if(!response.ok) throw new Error("Broward ElectionLink feed unavailable");
  const csv=await response.text();
  if(!/GENERAL ELECTION/i.test(csv)) throw new Error("Broward general election feed not published");
  return csv;
}

async function browardDashboard(){
  const response=await fetch(browardPartyDashboard,{cache:"no-store",headers:{Accept:"text/html,application/xhtml+xml"}});
  if(!response.ok) throw new Error("Broward VBM dashboard unavailable");
  const html=await response.text();
  if(!/2026 General Election/i.test(html)) throw new Error("Broward general election dashboard not published");
  for(const match of html.matchAll(/<script[^>]*class="ted-ec-initial"[^>]*>([\s\S]*?)<\/script>/gi)){
    try{
      const option=JSON.parse(match[1])?.option;
      const labels=option?.yAxis?.data;
      const returned=option?.series?.find((series:any)=>series?.name==="Returned")?.data;
      if(!Array.isArray(labels)||!Array.isArray(returned)||!labels.some((label:string)=>/Democratic Party/i.test(label))) continue;
      const value=(pattern:RegExp)=>{
        const index=labels.findIndex((label:string)=>pattern.test(label));
        return index>=0?Number(returned[index]||0):0;
      };
      return {
        mailParty:{dem:value(/Democratic Party/i),rep:value(/Republican Party/i),npa:value(/No Party Affiliation/i),other:value(/^Other$/i)},
        updated:html.match(/data-ted-dashboard-asof-src="([^"]+)"/i)?.[1]||null
      };
    }catch{}
  }
  throw new Error("Broward VBM party data unavailable");
}

function unavailable(code:string,name:string,sourceUrl=source(code)){
  return {code,name,sourceUrl,status:"unavailable" as const,registered:0,ballots:0,turnout:0,mail:0,early:0,electionDay:0,dem:0,rep:0,npa:0,other:0,mailParty:emptyMethod(),earlyParty:emptyMethod(),electionDayParty:emptyMethod(),updated:null,electionName:"",electionDate:""};
}

async function browardCounty(){
  try{
    const dashboard=await browardDashboard();
    const mailParty=dashboard.mailParty;
    const earlyParty=emptyMethod();
    const electionDayParty=emptyMethod();
    const mail=Object.values(mailParty).reduce((a,b)=>a+b,0);
    const early=0,electionDay=0;
    const dem=mailParty.dem+earlyParty.dem+electionDayParty.dem;
    const rep=mailParty.rep+earlyParty.rep+electionDayParty.rep;
    const npa=mailParty.npa+earlyParty.npa+electionDayParty.npa;
    const other=mailParty.other+earlyParty.other+electionDayParty.other;
    const ballots=dem+rep+npa+other;
    const registered=0;
    const updated=dashboard.updated;

    return {code:"BRO",name:"Broward",sourceUrl:browardVbmDashboard,status:"live" as const,registered,ballots,turnout:registered?ballots/registered*100:0,mail,early,electionDay,dem,rep,npa,other,mailParty,earlyParty,electionDayParty,updated,electionName:"2026 General Election",electionDate:"11/03/2026"};
  }catch{
    return unavailable("BRO","Broward",browardResultsPage);
  }
}

async function county(code:string,name:string){
  try{
    const j=await generalElectionData(code);

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
    return unavailable(code,name);
  }
}

export async function GET(request:NextRequest){
  const view=request.nextUrl.searchParams.get("view");
  if(view==="precincts"){
    const code=String(request.nextUrl.searchParams.get("county")||"").toUpperCase();
    const name=counties[code];
    if(!name) return NextResponse.json({error:"Choose a valid Florida county."},{status:400,headers:{"Cache-Control":"no-store"}});
    try{
      if(code==="BRO"){
        const csv=await browardCsv(browardPrecinctCsv);
        const precincts=browardPrecinctRows(csv);
        if(!precincts.length) return NextResponse.json({error:"Broward's official precinct table is active, but precinct rows have not been published yet."},{status:404,headers:{"Cache-Control":"public, max-age=30, s-maxage=60"}});
        return NextResponse.json({county:{code,name},updated:browardUpdated(csv),precincts},{headers:{"Cache-Control":"public, max-age=60, s-maxage=120, stale-while-revalidate=300"}});
      }
      const data=await generalElectionData(code);
      const precincts=precinctActivity(data);
      if(!precincts.length) return NextResponse.json({error:`${name} has not published precinct-level turnout activity yet.`},{status:404,headers:{"Cache-Control":"public, max-age=30, s-maxage=60"}});
      return NextResponse.json({county:{code,name},updated:data.Summary?.LastUpdatedTime||null,precincts},{headers:{"Cache-Control":"public, max-age=60, s-maxage=120, stale-while-revalidate=300"}});
    }catch{
      const error=code==="BRO"
        ? "Broward's official turnout dashboard is active, but its precinct table has not published precinct rows yet."
        : `${name} precinct data is not available through the live TQV feed yet.`;
      return NextResponse.json({error},{status:404,headers:{"Cache-Control":"public, max-age=30, s-maxage=60"}});
    }
  }
  const batchRaw=Number(request.nextUrl.searchParams.get("batch")||0);
  const batch=Number.isFinite(batchRaw)?Math.max(0,Math.floor(batchRaw)):0;
  const entries=Object.entries(counties).slice(batch*BATCH_SIZE,(batch+1)*BATCH_SIZE);
  const rows=await Promise.all(entries.map(([code,name])=>code==="BRO"?browardCounty():county(code,name)));
  const first=rows.find(r=>r.status==="live");
  return NextResponse.json({generatedAt:new Date().toISOString(),electionName:first?.electionName||"2026 General Election",electionDate:first?.electionDate||"11/03/2026",counties:rows},{headers:{"Cache-Control":"public, max-age=60, s-maxage=180, stale-while-revalidate=300"}});
}
