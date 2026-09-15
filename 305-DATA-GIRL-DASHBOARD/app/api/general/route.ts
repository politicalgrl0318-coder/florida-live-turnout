import { NextResponse } from "next/server";

const STATS_URL = "https://countyfilesvbm-ev.floridados.gov/VoteByMailEarlyVotingReports/PublicStats";
const REPORTS_URL = "https://countyfilesvbm-ev.floridados.gov/VoteByMailEarlyVotingReports/PublicReports";
const ELECTION_NUMBER = "49894";

const COUNTY_CODES: Record<string,string> = {
  Alachua:"ALA",Baker:"BAK",Bay:"BAY",Bradford:"BRA",Brevard:"BRE",Broward:"BRO",Calhoun:"CAL",Charlotte:"CHA",Citrus:"CIT",Clay:"CLA",Collier:"CLL",Columbia:"COL",DeSoto:"DES",Dixie:"DIX",Duval:"DUV",Escambia:"ESC",Flagler:"FLA",Franklin:"FRA",Gadsden:"GAD",Gilchrist:"GIL",Glades:"GLA",Gulf:"GUL",Hamilton:"HAM",Hardee:"HAR",Hendry:"HEN",Hernando:"HER",Highlands:"HIG",Hillsborough:"HIL",Holmes:"HOL","Indian River":"IND",Jackson:"JAC",Jefferson:"JEF",Lafayette:"LAF",Lake:"LAK",Lee:"LEE",Leon:"LEO",Levy:"LEV",Liberty:"LIB",Madison:"MAD",Manatee:"MAN",Marion:"MRN",Martin:"MRT","Miami-Dade":"DAD",Monroe:"MON",Nassau:"NAS",Okaloosa:"OKA",Okeechobee:"OKE",Orange:"ORA",Osceola:"OSC","Palm Beach":"PAL",Pasco:"PAS",Pinellas:"PIN",Polk:"POL",Putnam:"PUT","Santa Rosa":"SAN",Sarasota:"SAR",Seminole:"SEM","St. Johns":"STJ","St. Lucie":"STL",Sumter:"SUM",Suwannee:"SUW",Taylor:"TAY",Union:"UNI",Volusia:"VOL",Wakulla:"WAK",Walton:"WAL",Washington:"WAS"
};

const COUNTIES = Object.keys(COUNTY_CODES);

type Split = { rep:number; dem:number; other:number; npa:number; total:number; compiled:string };
type CountyRow = {
  code:string; name:string; sourceUrl:string; earlyVoting:string;
  provided:Split; voted:Split; early:Split;
};

const emptySplit = ():Split => ({rep:0,dem:0,other:0,npa:0,total:0,compiled:""});
const n = (v:string) => Number(v.replace(/[^0-9-]/g,"")) || 0;
const text = (html:string) => html
  .replace(/<br\s*\/?\s*>/gi," ")
  .replace(/<[^>]+>/g," ")
  .replace(/&nbsp;/gi," ")
  .replace(/&amp;/gi,"&")
  .replace(/&#39;/g,"'")
  .replace(/&quot;/g,'"')
  .replace(/\s+/g," ")
  .trim();

function rowsFromHtml(html:string){
  const rows:string[][]=[];
  for(const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>text(m[1]));
    if(cells.length) rows.push(cells);
  }
  return rows;
}

function parseStats(html:string){
  const byCounty = new Map<string,CountyRow>();
  COUNTIES.forEach(name=>byCounty.set(name,{code:COUNTY_CODES[name],name,sourceUrl:STATS_URL,earlyVoting:"",provided:emptySplit(),voted:emptySplit(),early:emptySplit()}));
  let block = -1;
  for(const cells of rowsFromHtml(html)){
    if(cells[0]==="Alachua" && cells[1]?.includes(ELECTION_NUMBER)) block++;
    const name=cells[0];
    if(!COUNTIES.includes(name) || !cells[1]?.includes(ELECTION_NUMBER) || cells.length<8 || block<0 || block>2) continue;
    const split:Split={rep:n(cells[2]),dem:n(cells[3]),other:n(cells[4]),npa:n(cells[5]),total:n(cells[6]),compiled:cells[7]||""};
    const row=byCounty.get(name)!;
    if(block===0) row.provided=split;
    else if(block===1) row.voted=split;
    else row.early=split;
  }
  return [...byCounty.values()];
}

function parseEarlyVoting(html:string){
  const map=new Map<string,string>();
  for(const cells of rowsFromHtml(html)){
    const name=cells[0];
    if(COUNTIES.includes(name) && cells[1]==="11/03/2026" && cells[2]) map.set(name,cells[2]);
  }
  return map;
}

function sum(rows:CountyRow[], key:"provided"|"voted"|"early"){
  return rows.reduce((a,r)=>({
    rep:a.rep+r[key].rep, dem:a.dem+r[key].dem, other:a.other+r[key].other,
    npa:a.npa+r[key].npa, total:a.total+r[key].total
  }),{rep:0,dem:0,other:0,npa:0,total:0});
}

export async function GET(){
  try{
    const [statsRes,reportsRes]=await Promise.all([
      fetch(STATS_URL,{cache:"no-store",headers:{"User-Agent":"305DataGirl/1.0"}}),
      fetch(REPORTS_URL,{cache:"no-store",headers:{"User-Agent":"305DataGirl/1.0"}})
    ]);
    if(!statsRes.ok) throw new Error(`Florida stats returned ${statsRes.status}`);
    const statsHtml=await statsRes.text();
    const rows=parseStats(statsHtml);
    if(rows.every(r=>r.provided.total===0 && r.voted.total===0 && r.early.total===0)) throw new Error("Florida general-election rows were not found in the state report.");
    if(reportsRes.ok){
      const windows=parseEarlyVoting(await reportsRes.text());
      rows.forEach(r=>{r.earlyVoting=windows.get(r.name)||""});
    }
    const compiled=rows.map(r=>r.provided.compiled||r.voted.compiled||r.early.compiled).filter(Boolean).sort().at(-1)||"";
    return NextResponse.json({
      generatedAt:new Date().toISOString(),
      compiled,
      electionName:"2026 General Election",
      electionNumber:ELECTION_NUMBER,
      electionDate:"11/03/2026",
      totals:{provided:sum(rows,"provided"),voted:sum(rows,"voted"),early:sum(rows,"early")},
      counties:rows
    },{headers:{"Cache-Control":"public, max-age=60, s-maxage=180, stale-while-revalidate=300"}});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to load Florida general-election activity."},{status:502,headers:{"Cache-Control":"no-store"}});
  }
}
