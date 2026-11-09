'use client';

import { useMemo, useState } from 'react';
import styles from './results.module.css';

type Candidate = { county: string; contest: string; name: string; party: string; votes: number };
type County = { county: string; url: string };
export type Snapshot = { election: string; collected: string; counties: County[]; rows: Candidate[] };
type Race = { title: string; candidates: Candidate[] };

// Florida Election Watch, November 3 general election, first unofficial returns.
const statewide: { title: string; candidates: [string, string, number][] }[] = [
  { title: 'U.S. Senate', candidates: [
    ['Ashley Moody', 'REP', 4211455], ['Angie Nixon', 'DEM', 3974148], ['Neil J. Gillespie', 'NPA', 94665],
  ] },
  { title: 'Governor & Lieutenant Governor', candidates: [
    ['Byron Donalds & Bryan Avila', 'REP', 4135701], ['David Jolly & Gwen Graham', 'DEM', 4029461],
    ['Scott Eckhard Jewett & Nicole Skelly', 'LPF', 37939], ['Frank J. Russo & Rachel Rodriguez', 'NPA', 23240],
    ['Charles Burkett & Ruben A. Coto', 'NPA', 15259], ['Dean Ocean Abrams & Joe Van Vactor', 'NPA', 12564],
    ['Jeffrey Peter “Dr. Jeff” Datto & Juan Santana', 'NPA', 8331],
    ['Moliere “Moe” Dimanche & Benjiman Rojas', 'NPA', 7606], ['Erik Morris & LeRoy Alaways', 'WRI', 102],
    ['Kathy Anderson & Daniel Nokovich', 'WRI', 21],
  ] },
  { title: 'Attorney General', candidates: [
    ['James Uthmeier', 'REP', 4181313], ['Jose Javier Rodriguez', 'DEM', 4029436],
  ] },
  { title: 'Chief Financial Officer', candidates: [
    ['Blaise Ingoglia', 'REP', 4154951], ['Annette Taddeo', 'DEM', 4002789],
  ] },
  { title: 'Commissioner of Agriculture', candidates: [
    ['Wilton Simpson', 'REP', 4163970], ['Joey Mendoza Atkins', 'DEM', 3989468], ['Kyle “KC” Gibson', 'WRI', 791],
  ] },
];

const number = new Intl.NumberFormat('en-US');
const normalized = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[.'’"]/g, '').replace(/\s+/g, ' ').trim();
const partyAffixes = /^(REP|DEM|NPA|LPF|WRI|NON|IND|FFP|GRE|PSL|ASP|CPF)\s+|\s*\((REP|DEM|NPA|LPF|WRI|NON|IND|FFP|GRE|PSL|ASP|CPF)\)$/gi;
const house = (name: string) => /^(?:rep(?:resentative)?\.?\s+(?:in\s+)?congress|u\.?s\.?\s+(?:congress|representative)).*?\b(?:district|dist)\.?\s*0*(\d+)\b/i.exec(name);
const federal = (name: string) => name === 'U.S. Senate' || name.startsWith('U.S. House');

function raceName(name: string) {
  const district = house(name);
  if (district) return `U.S. House · District ${Number(district[1])}`;
  if (/^(?:united states senator|u\.?s\.? senator)/i.test(name)) return 'U.S. Senate';
  if (/^governor\b/i.test(name)) return 'Governor & Lieutenant Governor';
  return name.trim().replace(/\s+/g, ' ');
}

function indexResults(rows: Candidate[]) {
  const districtsByCandidate = new Map<string, Set<string>>();
  const cleanName = (name: string) => name.trim().replace(partyAffixes, '').trim();
  for (const row of rows) {
    if (!house(row.contest)) continue;
    const key = normalized(cleanName(row.name));
    const districts = districtsByCandidate.get(key) ?? new Set<string>();
    districts.add(raceName(row.contest));
    districtsByCandidate.set(key, districts);
  }
  const unnamedHouse = /^(?:rep(?:resentative)?\.?\s+(?:in\s+)?congress|u\.?s\.?\s+(?:congress|representative))$/i;
  const counties = new Map<string, Map<string, Race>>();
  for (const raw of rows) {
    if (!Number.isFinite(raw.votes) || raw.votes < 0) continue;
    const name = cleanName(raw.name);
    const knownDistricts = districtsByCandidate.get(normalized(name));
    const title = unnamedHouse.test(raw.contest.trim())
      ? (knownDistricts?.size === 1 ? [...knownDistricts][0] : 'U.S. House · District unspecified')
      : raceName(raw.contest);
    if (!title || !name) continue;
    const ticket = title === 'Governor & Lieutenant Governor' ? name.split(/\s+(?:[&/]|and)\s+/i)[0] : name;
    const key = normalized(ticket);
    if (!counties.has(raw.county)) counties.set(raw.county, new Map());
    const races = counties.get(raw.county)!;
    const raceKey = normalized(title);
    if (!races.has(raceKey)) races.set(raceKey, { title, candidates: [] });
    const race = races.get(raceKey)!;
    const candidate = { ...raw, name, party: raw.party.trim().toUpperCase() };
    const existing = race.candidates.findIndex(row => normalized(title === 'Governor & Lieutenant Governor' ? row.name.split(/\s+(?:[&/]|and)\s+/i)[0] : row.name) === key);
    if (existing < 0) race.candidates.push(candidate);
    else if ((!race.candidates[existing].party && candidate.party) || candidate.votes > race.candidates[existing].votes) race.candidates[existing] = candidate;
  }
  for (const races of counties.values()) for (const race of races.values()) race.candidates.sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
  return counties;
}

function RaceCard({ race, expanded }: { race: Race; expanded: boolean }) {
  const top = race.candidates[0]?.votes ?? 0;
  const hasLeader = top > 0 && top > (race.candidates[1]?.votes ?? -1);
  return <details className={styles.race} open={expanded || undefined}>
    <summary>{race.title}</summary>
    <ul>{race.candidates.map((row, index) => {
      const status = hasLeader && index === 0 ? 'Leading' : row.votes < top ? 'Trailing' : '';
      return <li key={row.name} className={status === 'Leading' ? styles.leading : status === 'Trailing' ? styles.trailing : undefined}>
        <span>{row.name}{row.party && <small className={row.party === 'DEM' ? styles.dem : row.party === 'REP' ? styles.rep : styles.other}>{row.party}</small>}</span>
        <span><strong>{number.format(row.votes)}</strong>{status && <small className={styles.status}>{status}</small>}</span>
      </li>;
    })}</ul>
  </details>;
}

export default function Results({ snapshot }: { snapshot: Snapshot }) {
  const [county, setCounty] = useState('');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const indexed = useMemo(() => indexResults(snapshot.rows), [snapshot.rows]);
  const counties = useMemo(() => [...snapshot.counties].sort((a, b) => a.county.localeCompare(b.county)), [snapshot.counties]);
  const search = normalized(query);
  const cards = counties.filter(item => !county || item.county === county).map(item => ({
    ...item,
    races: [...(indexed.get(item.county)?.values() ?? [])].filter(race =>
      (scope === 'all' || (scope === 'federal') === federal(race.title)) &&
      (!search || normalized(item.county).includes(search) || normalized(race.title).includes(search) || race.candidates.some(row => normalized(row.name).includes(search)))
    ).sort((a, b) => Number(federal(b.title)) - Number(federal(a.title)) || a.title.localeCompare(b.title, undefined, { numeric: true })),
  })).filter(item => item.races.length || (!search && scope === 'all'));
  const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' }).format(new Date(snapshot.collected));
  return <>
    <section aria-labelledby="statewide-results-heading">
      <h2 id="statewide-results-heading">Statewide Races</h2>
      <p className={styles.note}>Florida’s first unofficial returns. <a href="https://floridaelectionwatch.gov/FederalOffices">U.S. Senate source</a> · <a href="https://floridaelectionwatch.gov/StateOffices/">State offices source</a></p>
      <div className={styles.grid}>{statewide.map(({ title, candidates }) =>
        <article key={title} className={styles.card}>
          <RaceCard expanded race={{ title, candidates: candidates.map(([name, party, votes]) => ({ name, party, votes, county: 'Statewide', contest: title })) }}/>
        </article>
      )}</div>
    </section>
    <h2 id="county-results-heading">County Results</h2>
    <div className={styles.tools}>
      <label>Search<input type="search" placeholder="Candidate, race or county" value={query} onChange={event => setQuery(event.target.value)}/></label>
      <label>County<select value={county} onChange={event => setCounty(event.target.value)}><option value="">All counties</option>{counties.map(item => <option key={item.county}>{item.county}</option>)}</select></label>
      <label>Race type<select value={scope} onChange={event => setScope(event.target.value)}><option value="all">All races</option><option value="federal">Federal races</option><option value="other">State and local races</option></select></label>
    </div>
    <p className={styles.note}>Unofficial county snapshot collected {date} ET. Leading and trailing labels refer to the county results shown. <a href="https://floridaelectionwatch.gov/FederalOffices">Official districtwide and statewide federal totals ↗</a></p>
    <div className={styles.grid}>{cards.map(item => <article key={item.county} className={styles.card}>
      <header><div><h2>{item.county}</h2><p>{item.races.length ? `${item.races.length} races` : 'Candidate totals unavailable in this snapshot'}</p></div><a href={item.url}>County results ↗</a></header>
      {item.races.map(race => <RaceCard key={race.title} race={race} expanded={Boolean(county || search || scope !== 'all')}/>)}
    </article>)}</div>
    {!cards.length && <p role="status">No races match the selected filters.</p>}
  </>;
}
