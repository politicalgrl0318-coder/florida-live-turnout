import { NextRequest } from "next/server";
import { GET as readCountyTurnout } from "../../../api/general-turnout/route";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type Party = { dem:number; rep:number; npa:number; other:number };
type County = {
  code:string; name:string; sourceUrl:string; status:string; updated:string|null;
  mail:number; early:number; electionDay:number; ballots:number;
  dem:number; rep:number; npa:number; other:number;
  mailParty:Party; earlyParty:Party; electionDayParty:Party;
};
const escape = (value:unknown) => String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const count = (value:unknown) => typeof value==="number"&&Number.isSafeInteger(value)&&value>=0?value.toLocaleString("en-US"):"Not reported";
const parties = ["dem","rep","npa","other"] as const;
function valid(row:County){
  if(row?.status!=="live") return false;
  const methods=[[row.mail,row.mailParty],[row.early,row.earlyParty],[row.electionDay,row.electionDayParty]] as const;
  return methods.every(([total,split])=>Number.isSafeInteger(total)&&total>=0&&split&&parties.every(p=>Number.isSafeInteger(split[p])&&split[p]>=0)&&parties.reduce((a,p)=>a+split[p],0)===total)
    &&row.ballots===row.mail+row.early+row.electionDay
    &&parties.every(p=>row[p]===row.mailParty[p]+row.earlyParty[p]+row.electionDayParty[p]);
}
function document(body:string){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>305 Data Girl | Live county source report</title><style>body{font:16px/1.5 system-ui,sans-serif;margin:2rem;max-width:1200px}nav a{margin-right:1rem}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:.6rem;text-align:right;border-bottom:1px solid #bbb}th:first-child,td:first-child{text-align:left}.scroll{overflow-x:auto}small{display:block}caption{text-align:left;font-weight:700;margin:1rem 0}</style></head><body><h1>305 Data Girl: live county source report</h1><nav><a href="/general">Dashboard</a>${[0,1,2,3,4].map(n=>`<a href="/general/live-report/${n}">County batch ${n+1}</a>`).join("")}</nav>${body}</body></html>`;
}
function html(body:string,status=200){
  return new Response(document(body),{status,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}

// Server-rendered verification view of the EXISTING county API, not a new data source.
// Keep its five batches separate to preserve the Worker's existing subrequest budget.
export async function GET(request:NextRequest,context:{params:Promise<{batch:string}>}){
  const {batch}=await context.params;
  if(!/^[0-4]$/.test(batch)) return html("<p>Choose county batch 0 through 4.</p>",400);
  try{
    const url=new URL("/api/general-turnout",request.url);
    url.searchParams.set("batch",batch);
    const response=await readCountyTurnout(new NextRequest(url));
    if(!response.ok) throw new Error("County source request failed.");
    const payload=await response.json();
    if(!Array.isArray(payload.counties)||!/general/i.test(String(payload.electionName))||!/^(?:11\/0?3\/2026|2026-11-03)(?:$|T|\s)/.test(String(payload.electionDate))) throw new Error("Current General Election report unavailable.");
    const rows=payload.counties as County[];
    const available=rows.filter(valid);
    let body=`<h2>2026 General Election | County batch ${Number(batch)+1} of 5</h2><p>Election 49894 • November 3, 2026. API checked: ${escape(payload.generatedAt||"Unavailable")}.</p><p>${available.length} of ${rows.length} county reports in this batch passed reconciliation. This is a partial county report, NOT a statewide total. Read all five batches for the county inventory.</p><p>Each county's source timestamp appears below. The check time is not the source publication time. The figures are the existing county API's reported counts; party registration is not candidate choice. Unavailable figures are not zeroes. Absentee-only sources report VBM only; their in-person methods and combined totals are not established here.</p>`;
    body+='<div class="scroll"><table><caption>County-reported voting methods and registered-party counts</caption><thead><tr><th>County / coverage</th><th>VBM</th><th>Early voting</th><th>Election Day</th><th>Combined</th><th>DEM reported</th><th>REP reported</th><th>NPA reported</th><th>Other reported</th><th>Source updated</th></tr></thead><tbody>';
    for(const row of rows){
      if(!valid(row)){
        body+=`<tr><td>${escape(row?.name||row?.code||"Unknown county")}</td><td colspan="9">Live report unavailable or failed reconciliation; do not treat as zero.</td></tr>`;
        continue;
      }
      const mailOnly=/\/AbsenteeTurnOut\//i.test(row.sourceUrl||"");
      const label=`${escape(row.name)} (${escape(row.code)})`;
      const safeUrl=/^https:\/\//i.test(row.sourceUrl||"")?escape(row.sourceUrl):"";
      body+=`<tr><td>${safeUrl?`<a href="${safeUrl}" rel="noreferrer">${label}</a>`:label}<small>${mailOnly?"VBM-only source; party counts below are VBM":"VBM + early + Election Day source"}</small></td><td>${count(row.mail)}</td><td>${mailOnly?"Not reported":count(row.early)}</td><td>${mailOnly?"Not reported":count(row.electionDay)}</td><td>${mailOnly?"Not reported":count(row.ballots)}</td>${parties.map(p=>`<td>${count(row[p])}</td>`).join("")}<td>${escape(row.updated||"Not supplied")}</td></tr>`;
    }
    body+='</tbody></table></div>';
    if(available.length){
      body+='<div class="scroll"><table><caption>Party counts by voting method for available county reports</caption><thead><tr><th>County / method</th><th>DEM</th><th>REP</th><th>NPA</th><th>Other</th></tr></thead><tbody>';
      for(const row of available){
        const mailOnly=/\/AbsenteeTurnOut\//i.test(row.sourceUrl||"");
        const methods=mailOnly?[["VBM",row.mailParty]] as const:[["VBM",row.mailParty],["Early voting",row.earlyParty],["Election Day",row.electionDayParty]] as const;
        for(const [method,split] of methods) body+=`<tr><td>${escape(row.code)} / ${method}</td>${parties.map(p=>`<td>${count(split[p])}</td>`).join("")}</tr>`;
      }
      body+='</tbody></table></div>';
    }
    body+='<p>State fallback figures are intentionally not added in this source view. The dashboard labels its separate state fallbacks. Never add this batch to the same counties in the state compilation.</p>';
    return html(body);
  }catch{
    return html("<p>The current county report could not be verified. No zero totals or previous-election data have been substituted. Use the dashboard or the official county reports and retry this verification view later.</p>",503);
  }
}
