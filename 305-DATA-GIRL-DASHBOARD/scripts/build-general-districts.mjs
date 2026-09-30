import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const sourceDir=process.argv[2]||process.env.VBM_DIR||"./vbm";
const output=process.argv[3]||"./public/data/general-districts.json";
const electionNumber="49894";
const files=fs.readdirSync(sourceDir).filter(name=>new RegExp("^[A-Z]{3}_VBM_"+electionNumber+".*\\.txt$","i").test(name));
if(!files.length) throw new Error("No county VBM files found in "+sourceDir);

const chambers={congressional:new Map(),house:new Map(),senate:new Map()};
const coverage=[];
let dataThrough="";
let sentThrough="";
const cols={congressional:"CongressionalDistrict",house:"HouseDistrict",senate:"SenateDistrict"};
const partyKey=p=>p==="DEM"||p==="REP"||p==="NPA"?p:"OTHER";
const blank=()=>({sent:0,returned:0,demSent:0,repSent:0,npaSent:0,otherSent:0,demReturned:0,repReturned:0,npaReturned:0,otherReturned:0});

for(const name of files){
  const full=path.join(sourceDir,name);
  const input=fs.createReadStream(full,{encoding:"utf8"});
  const rl=readline.createInterface({input,crlfDelay:Infinity});
  let header=null,index={};let records=0,sent=0,returned=0,maxReturn="",maxDelivery="";
  for await(const line0 of rl){
    const line=records===0?line0.replace(/^\uFEFF/,""):line0;
    if(!header){header=line.split("\t");header.forEach((h,i)=>index[h]=i);continue}
    if(!line)continue;
    records++;
    const row=line.split("\t");
    const delivery=(row[index["Delivery Date"]]||"").trim();
    const ret=(row[index["BallotReturnDate"]]||"").trim();
    const party=partyKey((row[index.Party]||"").trim().toUpperCase());
    if(delivery){sent++;if(delivery>maxDelivery)maxDelivery=delivery}
    if(ret){returned++;if(ret>maxReturn)maxReturn=ret}
    for(const [chamber,col] of Object.entries(cols)){
      const raw=(row[index[col]]||"").trim();
      const district=String(Number(raw));
      if(!raw||district==="0"||district==="NaN")continue;
      const map=chambers[chamber];
      const current=map.get(district)||blank();
      if(delivery){current.sent++;current[party.toLowerCase()+"Sent"]++}
      if(ret){current.returned++;current[party.toLowerCase()+"Returned"]++}
      map.set(district,current);
    }
  }
  const code=name.slice(0,3).toUpperCase();
  coverage.push({code,name:code,records,sent,returned,throughReturnDate:maxReturn,throughDeliveryDate:maxDelivery});
  if(maxReturn>dataThrough)dataThrough=maxReturn;
  if(maxDelivery>sentThrough)sentThrough=maxDelivery;
}

const rows=map=>[...map.entries()].sort((a,b)=>Number(a[0])-Number(b[0])).map(([district,x])=>({...x,district,returnRate:x.sent?Number((x.returned/x.sent*100).toFixed(4)):0,drReturnMargin:x.demReturned-x.repReturned,drSentMargin:x.demSent-x.repSent}));
const payload={generatedAt:new Date().toISOString(),election:"2026 General Election",electionDate:"11/03/2026",electionNumber,dataThrough,sentThrough,complete:files.length>=67,coverage:{countiesLoaded:files.length,countiesExpected:67,countyFiles:coverage,note:files.length>=67?"All 67 county voter-level VBM files are loaded.":"District totals are partial until all 67 county voter-level VBM files are loaded. Missing counties are never treated as zero."},districts:{congressional:rows(chambers.congressional),house:rows(chambers.house),senate:rows(chambers.senate)},definitions:{sent:"Records with a populated Delivery Date.",returned:"Records with a populated BallotReturnDate.",returnRate:"Returned divided by sent/provided within the loaded county voter files."}};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(payload));
console.log("Wrote "+output+" from "+files.length+" county file(s).");
