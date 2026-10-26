import {NextResponse} from 'next/server';
export const runtime='edge';
export const dynamic='force-dynamic';

// civicAPI-derived publication, mirrored by 50501 Veterans. The documented civicAPI v2
// endpoints do not currently enumerate a verified early-vote JSON route.
// Fail closed rather than showing stale, partial, or invented party data.
const origin='https://election-watch.50501vets.com/map/FL?cat=';
type Split={dem:number;rep:number;npa:number;other:number;total:number;unallocated:number};
function parse(html:string,kind:'returned'|'inperson'){
 const plain=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&#(?:39|x27);/gi,"'").replace(/&amp;/gi,'&').replace(/\s+/g,' ');
 const updated=plain.match(/Early vote counts updated\s+(Oct(?:ober)?\s+\d{1,2},?\s+\d{1,2}:\d{2}\s*[AP]M\s*ET)/i)?.[1];
 const date=plain.match(/Counts as of\s+(Oct(?:ober)?\s+\d{1,2},?\s+2026)/i)?.[1];
 const total=plain.match(kind==='returned'?/(\d[\d,]*)\s+ballots returned/i:/(\d[\d,]*)\s+ballots in person/i)?.[1];
 const partyBlock=plain.split(/By party registration/i)[1]?.split(/Party is the registration/i)[0]||'';
 const extract=(name:string)=>Number(partyBlock.match(new RegExp(name+'\\s+([\\d,]+)\\s*\\(' ,'i'))?.[1]?.replace(/,/g,''));
 const split:Split={dem:extract('Democratic'),rep:extract('Republican'),npa:extract('No Party Affiliation'),other:extract('Other'),total:Number(total?.replace(/,/g,'')),unallocated:0};
 if(!updated||!date||!total||Object.values(split).some(x=>!Number.isSafeInteger(x)||x<0)||split.dem+split.rep+split.npa+split.other!==split.total)throw Error('Tracker report does not reconcile');
 const checked=new Date(updated.replace(/\s+ET$/,'')+' EDT');
 // Date formatting is intentionally visible so failed parsing cannot appear current.
 if(!Number.isFinite(checked.getTime())||!/2026$/.test(date)||Math.abs(Date.now()-checked.getTime())>36*3600000)throw Error('Tracker publication is stale or undated');
 return {split,updatedLabel:updated,sourceDate:date,sourceUrl:origin+kind};
}
export async function GET(){
 try{
  const [mail,early]=await Promise.all((['returned','inperson'] as const).map(async kind=>{
   const res=await fetch(origin+kind,{cache:'no-store',signal:AbortSignal.timeout(9000),headers:{'Accept':'text/html'}});
   if(!res.ok)throw Error('Tracker returned '+res.status);
   return parse(await res.text(),kind);
  }));
  const combined:Split={dem:mail.split.dem+early.split.dem,rep:mail.split.rep+early.split.rep,npa:mail.split.npa+early.split.npa,other:mail.split.other+early.split.other,total:mail.split.total+early.split.total,unallocated:0};
  if(combined.dem+combined.rep+combined.npa+combined.other!==combined.total)throw Error('Combined totals do not reconcile');
  return NextResponse.json({source:'civicAPI via 50501 Veterans published tracker',election:'2026 Florida General Election',checkedAt:new Date().toISOString(),mail,early,combined,warning:'Third-party cumulative totals with different method timestamps; county-level official reconciliation remains separate. Cross-method unique-voter overlap not verified.'},{headers:{'Cache-Control':'public, s-maxage=60, stale-while-revalidate=60'}});
 }catch(e){return NextResponse.json({error:'Current civicAPI-derived publication unavailable or invalid; official county data remains available.',detail:e instanceof Error?e.message:'Unknown error'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
