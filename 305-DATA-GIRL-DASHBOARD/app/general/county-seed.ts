import seed from '../../public/data/general-county-seed.json';
import expected from '../../public/data/general-county-baseline.json';
import {COUNTY_NAMES,makeCountyRow,validMethod,sourceStamp,type CountyMethod,type TurnoutRow} from './method-selection';
export const SEED_CHECKED_AT=seed.checkedAt;
export function countySeed():TurnoutRow[]{
 try{
  if(seed.electionNumber!=='49894'||seed.electionDate!=='2026-11-03'||seed.rows.length!==67)throw new Error('Invalid baseline election or inventory');
  const seen=new Set<string>();
  const totals={mail:[0,0,0,0,0,0],early:[0,0,0,0,0,0]};
  const rows=seed.rows.map(raw=>{
   const [code,mailTime,mailValues,earlyTime,earlyValues]=raw as [string,string,number[],string,number[]];
   if(!COUNTY_NAMES[code]||seen.has(code))throw new Error('Invalid baseline county');seen.add(code);
   const method=(kind:'mail'|'early',reported:string,v:number[]):CountyMethod=>{
    if(v.length!==6||!sourceStamp(reported))throw new Error('Invalid baseline schema');
    const sourceUrl=code==='BRO'?`https://my.browardvotes.gov/TEDElectionLink/${kind==='mail'?'AbsenteeTurnOut/dashboard/view/absturnout-party':'TurnOutWidget/dashboard/view/turnout-party'}`:`https://tqv.vrswebapps.com/?state=FL&county=${code.toLowerCase()}`;
    const report={total:v[5],parties:{dem:v[0],rep:v[1],npa:v[2],other:v[3]},unallocated:v[4],reported,sourceUrl,retained:true,note:`Saved county-method baseline checked ${seed.checkedAt}. Original source date preserved; not a current retrieval.`};
    if(!validMethod(report))throw new Error('Baseline method fails reconciliation');v.forEach((n,i)=>totals[kind][i]+=n);return report;
   };
   return makeCountyRow(code,COUNTY_NAMES[code],{mail:method('mail',mailTime,mailValues),early:method('early',earlyTime,earlyValues),electionDay:null},{fetchedAt:seed.checkedAt});
  });
  const fields=['dem','rep','npa','other','unallocated','total'] as const;
  for(const method of ['mail','early'] as const)fields.forEach((key,i)=>{if(totals[method][i]!==expected.methods[method][key])throw new Error('Baseline differs from verified archive');});
  return rows;
 }catch{return [];}
}
