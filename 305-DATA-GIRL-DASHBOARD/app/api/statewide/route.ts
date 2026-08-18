import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type PartySplit = { dem:number; rep:number; npa:number; other:number };
type CountyRow = {
  code:string;
  name:string;
  status:"live"|"unavailable";
  registered:number;
  ballots:number;
  turnout:number;
  mail:number;
  early:number;
  electionDay:number;
  dem:number;
  rep:number;
  npa:number;
  other:number;
  mailParty?:PartySplit;
  earlyParty?:PartySplit;
  electionDayParty?:PartySplit;
  updated:string|null;
};

type BatchPayload = {
  generatedAt:string;
  electionName:string;
  electionDate:string;
  batch:number;
  totalBatches:number;
  counties:CountyRow[];
};

const emptySplit = ():PartySplit => ({dem:0,rep:0,npa:0,other:0});
const addSplit = (a:PartySplit,b?:PartySplit):PartySplit => ({
  dem:a.dem+(b?.dem||0),
  rep:a.rep+(b?.rep||0),
  npa:a.npa+(b?.npa||0),
  other:a.other+(b?.other||0),
});

function summarizeSplit(split:PartySplit){
  const total=split.dem+split.rep+split.npa+split.other;
  const denom=total||1;
  const margin=split.dem-split.rep;
  return {
    total,
    ...split,
    shares:{
      dem:split.dem/denom*100,
      rep:split.rep/denom*100,
      npa:split.npa/denom*100,
      other:split.other/denom*100,
    },
    margin:{
      leader:margin>=0?"D":"R",
      votes:Math.abs(margin),
      points:Math.abs(margin)/denom*100,
    },
  };
}

export async function GET(request:Request){
  const origin=new URL(request.url).origin;
  const stamp=Date.now();
  const fetchBatch=async(batch:number):Promise<BatchPayload>=>{
    const response=await fetch(`${origin}/api/turnout?batch=${batch}&t=${stamp}`,{
      cache:"no-store",
      headers:{"X-305-Internal":"statewide"},
    });
    if(!response.ok) throw new Error(`Turnout batch ${batch} failed with ${response.status}`);
    return await response.json() as BatchPayload;
  };

  const first=await fetchBatch(0);
  const rest=await Promise.all(Array.from({length:Math.max(0,first.totalBatches-1)},(_,i)=>fetchBatch(i+1)));
  const batches=[first,...rest];
  const counties=batches.flatMap(batch=>batch.counties);
  const live=counties.filter(c=>c.status==="live");

  const totals=live.reduce((a,c)=>({
    registered:a.registered+c.registered,
    ballots:a.ballots+c.ballots,
    mail:a.mail+c.mail,
    early:a.early+c.early,
    electionDay:a.electionDay+c.electionDay,
    dem:a.dem+c.dem,
    rep:a.rep+c.rep,
    npa:a.npa+c.npa,
    other:a.other+c.other,
  }),{registered:0,ballots:0,mail:0,early:0,electionDay:0,dem:0,rep:0,npa:0,other:0});

  const mailParty=live.reduce((a,c)=>addSplit(a,c.mailParty),emptySplit());
  const earlyParty=live.reduce((a,c)=>addSplit(a,c.earlyParty),emptySplit());
  const electionDayParty=live.reduce((a,c)=>addSplit(a,c.electionDayParty),emptySplit());
  const overallParty:PartySplit={dem:totals.dem,rep:totals.rep,npa:totals.npa,other:totals.other};

  return NextResponse.json({
    generatedAt:new Date().toISOString(),
    electionName:first.electionName||"2026 Primary Election",
    electionDate:first.electionDate||"08/18/2026",
    reporting:{count:live.length,total:counties.length,complete:live.length===counties.length,unavailable:counties.filter(c=>c.status!=="live").map(c=>c.name)},
    turnout:{
      ballots:totals.ballots,
      registered:totals.registered,
      turnoutPercent:totals.registered?totals.ballots/totals.registered*100:0,
      voteByMail:totals.mail,
      earlyVoting:totals.early,
      electionDay:totals.electionDay,
    },
    party:summarizeSplit(overallParty),
    methods:{
      voteByMail:summarizeSplit(mailParty),
      earlyVoting:summarizeSplit(earlyParty),
      electionDay:summarizeSplit(electionDayParty),
    },
    counties,
  },{headers:{
    "Cache-Control":"no-store, no-cache, must-revalidate, max-age=0",
    "CDN-Cache-Control":"no-store",
    "Cloudflare-CDN-Cache-Control":"no-store",
    "Pragma":"no-cache",
    "Expires":"0",
  }});
}
