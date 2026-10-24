import {NextRequest} from 'next/server';
import {GET as readCountyTurnout} from '../../../api/general-turnout/route';
import {reconcileTurnout,isCurrentGeneral,METHODS,PARTIES,type TurnoutRow} from '../../method-selection';
export const runtime='edge';
export const dynamic='force-dynamic';
const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const n=(v:number)=>Number.isSafeInteger(v)&&v>=0?v.toLocaleString('en-US'):'Not reported';
const labels={mail:'VBM returned',early:'Early voting',electionDay:'Election Day'};
function document(body:string){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>305 Data Girl | County source report</title><style>body{font:16px/1.6 system-ui,sans-serif;margin:24px;max-width:1200px}nav{display:flex;flex-wrap:wrap;gap:12px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{padding:10px;text-align:right;border-bottom:1px solid #ccc;vertical-align:top}th:first-child,td:first-child{text-align:left}small{display:block;margin-top:5px}.scroll{overflow:auto}section{margin:24px 0;padding-top:12px;border-top:1px solid #bbb}h2{margin:0 0 10px}p{overflow-wrap:anywhere}</style></head><body><h1>305 Data Girl: county source report</h1><nav><a href="/general">Dashboard</a>${[0,1,2,3,4].map(b=>`<a href="/general/live-report/${b}">Batch ${b+1}</a>`).join('')}</nav>${body}</body></html>`;}
function html(body:string,status=200){return new Response(document(body),{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
// Presentation of the same five county API batches; not an independent source.
export async function GET(request:NextRequest,context:{params:Promise<{batch:string}>}){
 const {batch}=await context.params;if(!/^[0-4]$/.test(batch))return html('<p>Choose batch 0 through 4.</p>',400);
 try{
  const url=new URL('/api/general-turnout',request.url);url.searchParams.set('batch',batch);
  const response=await readCountyTurnout(new NextRequest(url));if(!response.ok)throw new Error('County retrieval failed');
  const payload=await response.json();if(!Array.isArray(payload.counties)||String(payload.electionNumber)!=='49894'||!isCurrentGeneral(payload.electionName,payload.electionDate))throw new Error('Election not verified');
  const raw=payload.counties as TurnoutRow[],codes=new Set(raw.map(r=>r.code));
  const selection=reconcileTurnout(raw,null,Date.now()),rows=selection.rows.filter(r=>codes.has(r.code));
  let body=`<h2>2026 General Election · Batch ${Number(batch)+1} of 5</h2><p>Election 49894 · November 3, 2026. API check: ${escape(payload.generatedAt)}.</p><p>${rows.length} counties in this partial batch. This is NOT a statewide total and is NOT an independent cross-check. Read all five batches for the full inventory.</p><p>One selected county report per method. Original source dates, retained reports, missing methods and unallocated parties are shown below. No state fallback figures are included. Refreshing a saved report does not make it current. Provisional ballots are excluded. Party registration is not candidate preference.</p>`;
  for(const row of rows){const has=METHODS.some(m=>row.methods[m]);body+=`<section><h2>${escape(row.name)} (${escape(row.code)})</h2><p>Combined included methods: ${has?n(row.ballots):'Not reported'}. ${row.missing.length?'PARTIAL: missing '+row.missing.map(m=>labels[m]).join(', ')+'.':'Active methods covered.'} Unallocated party ballots: ${has?n(row.unallocated):'Not reported'}.</p><div class="scroll"><table><thead><tr><th>Method / source</th><th>Total</th><th>DEM</th><th>REP</th><th>NPA</th><th>Other</th><th>Unallocated</th></tr></thead><tbody>`;
   for(const method of METHODS){const r=row.methods[method];if(!r){body+=`<tr><td>${labels[method]}</td><td colspan="6">${selection.beforeElectionDay&&method==='electionDay'?'Not begun; scheduled for November 3.':'Not reported; missing is not zero.'}</td></tr>`;continue;}body+=`<tr><td>${labels[method]}<small>${r.retained?'RETAINED COUNTY REPORT':r.freshness==='recent'?'RECENT COUNTY REPORT':'DELAYED / UNDATED COUNTY REPORT'}</small><small>Source: ${escape(r.reported)}</small><small><a href="${escape(r.sourceUrl)}" rel="noreferrer">Official method source</a></small>${r.note?`<small>${escape(r.note)}</small>`:''}</td><td>${n(r.total)}</td>${PARTIES.map(p=>`<td>${n(r.parties[p])}</td>`).join('')}<td>${n(r.unallocated)}</td></tr>`;}
   body+='</tbody></table></div>';row.warnings.forEach(w=>body+=`<p>Reporting limitation: ${escape(w)}</p>`);body+='</section>';
  }
  body+='<p>Do not add these counties to the same counties in the state compilation. State fallbacks are selected separately on the main dashboard. This source view contains only county-method reports, including clearly marked retained county evidence.</p>';return html(body);
 }catch{return html('<p>The county reports could not be verified through this reader. No zero totals are inferred; this does not establish that the official county feeds are inactive.</p>',503);}
}
