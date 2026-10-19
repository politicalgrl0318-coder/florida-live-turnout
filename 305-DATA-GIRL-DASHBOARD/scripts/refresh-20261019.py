"""Rebuild aggregate-only public data from the verified Oct 19 county originals.
Usage: python scripts/refresh-20261019.py ORIGINALS_DIR STATE_SUMMARY_JSON
No voter names, IDs, addresses or contact details are written to public files.
"""
import csv,json,sys,datetime,collections
from pathlib import Path
root=Path(__file__).resolve().parents[1]; out=root/'public/data'
source=Path(sys.argv[1]); summary=json.load(open(sys.argv[2]))
assert summary['electionNumber']=='49894' and summary['compiled']=='10/19/2026 8:04AM' and not summary.get('savedSnapshot')
parties=['dem','rep','npa','other']; missing=['DIX','GAD','HAM','HEN','LEV','LIB','MRT','STL','SUM']
names='Dixie, Gadsden, Hamilton, Hendry, Levy, Liberty, Martin, St. Lucie and Sumter'
files=sorted(source.glob('*_VBM_49894.txt'));assert len(files)==58
prior=json.loads((out/'general-official-snapshot.json').read_text()); assert prior['compiled']=='10/18/2026 8:04AM'
old={c['code']:c for c in prior['counties']}
for c in summary['counties']:
 for method in ['provided','voted','early']: assert sum(c[method][p] for p in parties)==c[method]['total']
 c['changeReturned']=c['voted']['total']-old[c['code']]['voted']['total']
for method in ['provided','voted','early']:
 assert sum(c[method]['total'] for c in summary['counties'])==summary['totals'][method]['total']
summary.update(baseline={'compiled':prior['compiled'],'sent':prior['totals']['provided']['total']+prior['totals']['voted']['total'],'returned':prior['totals']['voted']['total'],**{p+'Returned':prior['totals']['voted'][p] for p in parties}},activityThrough='October 18, 2026',sourceUrl='https://countyfilesvbm-ev.floridados.gov/VoteByMailEarlyVotingReports/PublicStats',snapshotNotice='October 19, 2026, 8:04 AM ET state compilation. County submissions retain their individual reporting times.',dailyComparisonAvailable=True,dailyComparisonNote='Changes compare the October 19 and October 18 state compilations, not ballots cast during a single day.')
summary['totals']['changeReturned']=summary['totals']['voted']['total']-prior['totals']['voted']['total']
def write(name,x): (out/name).write_text(json.dumps(x,ensure_ascii=False,separators=(',',':'))+'\n')
write('general-official-snapshot.json',summary)
history=json.loads((out/'general-conversion-history.json').read_text());history=[x for x in history if x['date']!='2026-10-19']
history.append({'date':'2026-10-19','compiled':summary['compiled'],'returned':{p:summary['totals']['voted'][p] for p in parties},'requested':{p:summary['totals']['voted'][p]+summary['totals']['provided'][p] for p in parties}});write('general-conversion-history.json',history)
def blank(): return dict(sent=0,provided=0,returned=0,**{p+suffix:0 for p in parties for suffix in ['Sent','Returned']})
def add(x,p,status):
 x['sent']+=1;x[p+'Sent']+=1
 if status=='P': x['provided']+=1
 else: x['returned']+=1;x[p+'Returned']+=1
chambers={'congressional':('CongressionalDistrict',28),'senate':('SenateDistrict',40),'house':('HouseDistrict',120)}
rows={c:{str(d):blank() for d in range(1,n+1)} for c,(_,n) in chambers.items()}; statewide=blank(); precincts={}; county_totals={}; valid=0
for f in files:
 code=f.name[:3];total=blank()
 with f.open(encoding='utf-8-sig',newline='') as h:
  for r in csv.DictReader(h,delimiter='\t'):
   assert r['CountyId']==code and r['ElectionNumber']=='49894'
   status=(r.get('VoteByMail') or r.get('VoteByMailStatus') or '').strip()
   if status not in ['P','V']:continue
   p=r['Party'].strip().lower();p=p if p in parties else 'other'
   add(total,p,status);add(statewide,p,status);valid+=1
   for chamber,(col,limit) in chambers.items():
    raw=r[col].strip()
    if raw.isdigit() and 1<=int(raw)<=limit:add(rows[chamber][str(int(raw))],p,status)
 county_totals[code]=total
# Validate source totals against the separately fetched official county summary.
for code,x in county_totals.items():
 c=next(c for c in summary['counties'] if c['code']==code)
 assert x['returned']==c['voted']['total'],(code,x['returned'],c['voted']['total'])
 assert x['provided']==c['provided']['total'],(code,x['provided'],c['provided']['total'])
for chamber,(_,limit) in chambers.items():
 filenames=[f'general-districts-house-{i}.json' for i in range(1,5)] if chamber=='house' else [f'general-districts-{chamber}.json']
 previous={r['district']:r for fn in filenames for r in json.loads((out/fn).read_text())}
 values=[]
 for d,x in rows[chamber].items():
  r={'district':d,**x,'returnRate':100*x['returned']/x['sent'] if x['sent'] else 0,'drReturnMargin':x['demReturned']-x['repReturned'],'drSentMargin':x['demSent']-x['repSent'],'npaShare':100*x['npaReturned']/x['returned'] if x['returned'] else 0}
  for p in parties:r[p+'Rate']=100*x[p+'Returned']/x[p+'Sent'] if x[p+'Sent'] else 0;r[p+'RateRank']=None
  for k in ['Returned','Sent','Rate','Margin']:r['change'+k]=None
  # Both constituent counties are present in both snapshots for these districts.
  if chamber=='congressional' and d in ['27','28']:
   b=previous[d]
   r.update(changeReturned=r['returned']-b['returned'],changeSent=r['sent']-b['sent'],changeRate=r['returnRate']-b['returnRate'],changeMargin=r['drReturnMargin']-b['drReturnMargin'])
  values.append(r)
 if chamber=='house':
  for i,fn in enumerate(filenames):write(fn,values[i*30:(i+1)*30])
 else:write(filenames[0],values)
metadata=json.loads((out/'general-districts.json').read_text())
metadata.update(generatedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),snapshotDate='October 19, 2026',snapshotCompiled='October 19, 2026, 8:04 AM ET',dataThrough='October 18, 2026',complete=False,sourcePackage='58 original county files from the October 19, 2026 DOE posting',baselineDate='October 18, 2026, 8:04 AM ET; changes shown only for FL-27 and FL-28, whose county coverage is verified in both snapshots',coverage={'countiesLoaded':58,'countiesExpected':67,'countiesCurrent':58,'missing':missing,'carriedForward':[],'note':f'{names} have no October 19 file. Totals below include only the 58 supplied counties; affected districts are incomplete. FL-27 and FL-28 have complete county coverage. Statewide ranks are withheld while county coverage is incomplete. Daily changes are shown only for FL-27 and FL-28, whose county coverage was verified in both snapshots. The state summary separately retains earlier county reports with their original timestamps.'},statewide=statewide,excludedCongressional={'sent':statewide['sent']-sum(r['sent'] for r in rows['congressional'].values()),'returned':statewide['returned']-sum(r['returned'] for r in rows['congressional'].values())})
metadata.pop('unavailableChangeDistricts',None);write('general-districts.json',metadata)
assert rows['congressional']['28']['returned']==22070
print(json.dumps({'state':summary['totals'],'voterFiles':statewide,'FL28':rows['congressional']['28'],'FL27':rows['congressional']['27']},indent=2))
