"""Export public precinct aggregates only; no voter-level information."""
import csv,sys,collections
from pathlib import Path
source=Path(sys.argv[1]);output=Path(__file__).resolve().parents[1]/'public/data/general-fl27-fl28-precincts.csv'
fields='district county precinct sent provided returned demSent demReturned repSent repReturned npaSent npaReturned otherSent otherReturned demOutstanding npaOutstanding'.split()
rows={}
for code in ['DAD','MON']:
 with (source/f'{code}_VBM_49894.txt').open(encoding='utf-8-sig',newline='') as f:
  for v in csv.DictReader(f,delimiter='\t'):
   d=v['CongressionalDistrict'];status=v['VoteByMail']
   if d not in ['27','28'] or status not in ['P','V']:continue
   precinct=v['Precinct'].strip();key=(d,code,precinct);r=rows.setdefault(key,dict(zip(fields,[d,code,precinct]+[0]*(len(fields)-3))))
   p=v['Party'].lower();p=p if p in ['dem','rep','npa'] else 'other'
   r['sent']+=1;r[p+'Sent']+=1;r['provided' if status=='P' else 'returned']+=1
   if status=='V':r[p+'Returned']+=1
   elif p in ['dem','npa']:r[p+'Outstanding']+=1
with output.open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=fields,lineterminator="\n");w.writeheader();w.writerows(rows[k] for k in sorted(rows))
print('Updated',len(rows),'precinct rows', {d:sum(r['returned'] for r in rows.values() if r['district']==d) for d in ['27','28']})
