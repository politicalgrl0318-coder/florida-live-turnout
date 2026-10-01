import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const sourceDir=process.argv[2]||process.env.VBM_DIR||"./vbm";
const outputDir=process.argv[3]||"./public/data";
const electionNumber="49894";
const files=fs.readdirSync(sourceDir).filter(name=>new RegExp("^[A-Z]{3}_VBM_"+electionNumber+".*\\.txt$","i").test(name));
if(!files.length) throw new Error("No county VBM files found in "+sourceDir);

const chamberCols={congressional:"CongressionalDistrict",house:"HouseDistrict",senate:"SenateDistrict"};
const limits={congressional:28,house:120,senate:40};
const chambers={congressional:new Map(),house:new Map(),senate:new Map()};
const partyKey=p=>p==="DEM"||p==="REP"||p==="NPA"?p:"OTHER";
const blank=()=>({sent:0,provided:0,returned:0,demSent:0,repSent:0,npaSent:0,otherSent:0,demReturned:0,repReturned:0,npaReturned:0,otherReturned:0});
const statewide={provided:0,returned:0,sent:0,demReturned:0,repReturned:0,npaReturned:0,otherReturned:0};
let dataThrough="";

for(const name of files){
  const input=fs.createReadStream(path.join(sourceDir,name),{encoding:"utf8"});
  const rl=readline.createInterface({input,crlfDelay:Infinity});
  let header=null,index={};
  for await(const line0 of rl){
    const line=line0.replace(/^\uFEFF/,"");
    if(!header){header=line.split("\t");header.forEach((h,i)=>index[h]=i);continue}
    if(!line)continue;
    const row=line.split("\t");
    const status=(row[index.VoteByMail]||"").trim().toUpperCase();
    if(status!=="P"&&status!=="V")continue;
    const party=partyKey((row[index.Party]||"").trim().toUpperCase());
    const prefix=party.toLowerCase();
    statewide.sent++;
    if(status==="P")statewide.provided++;
    else{
      statewide.returned++;
      statewide[prefix+"Returned"]++;
      const ret=(row[index.BallotReturnDate]||"").trim();
      if(ret>dataThrough)dataThrough=ret;
    }

    for(const [chamber,col] of Object.entries(chamberCols)){
      const raw=(row[index[col]]||"").trim();
      const match=raw.match(/\d+/);
      if(!match)continue;
      const district=Number(match[0]);
      if(district<1||district>limits[chamber])continue;
      const key=String(district);
      const current=chambers[chamber].get(key)||blank();
      current.sent++;
      current[prefix+"Sent"]++;
      if(status==="P")current.provided++;
      else{current.returned++;current[prefix+"Returned"]++}
      chambers[chamber].set(key,current);
    }
  }
}

const rows=map=>[...map.entries()].sort((a,b)=>Number(a[0])-Number(b[0])).map(([district,x])=>({
  district,
  sent:x.sent,
  returned:x.returned,
  demReturned:x.demReturned,
  repReturned:x.repReturned,
  npaReturned:x.npaReturned,
  otherReturned:x.otherReturned,
  returnRate:x.sent?Number((x.returned/x.sent*100).toFixed(4)):0,
  drReturnMargin:x.demReturned-x.repReturned,
  drSentMargin:x.demSent-x.repSent,
}));

fs.mkdirSync(outputDir,{recursive:true});
const write=(name,value)=>fs.writeFileSync(path.join(outputDir,name),JSON.stringify(value));

const congressional=rows(chambers.congressional);
const house=rows(chambers.house);
const senate=rows(chambers.senate);
write("general-districts-congressional.json",congressional);
write("general-districts-senate.json",senate);
for(let i=0;i<4;i++)write("general-districts-house-"+(i+1)+".json",house.slice(i*30,(i+1)*30));

write("general-districts.json",{
  generatedAt:new Date().toISOString(),
  election:"2026 General Election",
  electionDate:"11/03/2026",
  electionNumber,
  dataThrough,
  complete:files.length===67,
  coverage:{
    countiesLoaded:files.length,
    countiesExpected:67,
    note:files.length===67
      ?"All 67 county voter-level VBM files are loaded. Status P is counted as provided/not yet returned and status V as voted/returned."
      :"District totals are partial until all 67 county voter-level VBM files are loaded."
  },
  statewide,
  files:{
    congressional:["/data/general-districts-congressional.json"],
    house:["/data/general-districts-house-1.json","/data/general-districts-house-2.json","/data/general-districts-house-3.json","/data/general-districts-house-4.json"],
    senate:["/data/general-districts-senate.json"]
  },
  definitions:{
    provided:"VoteByMail status P (provided, not yet returned).",
    returned:"VoteByMail status V (voted/returned).",
    sent:"Provided plus returned (P + V).",
    returnRate:"Returned divided by sent/provided universe (V ÷ (P + V))."
  }
});
console.log("Wrote statewide district data from "+files.length+" county file(s).");
