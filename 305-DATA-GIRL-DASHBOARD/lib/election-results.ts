export type ElectionCandidate = {
  id: string;
  name: string;
  party: string;
  votes: number;
  percentage: number;
  winner?: boolean;
};

export type ElectionContest = {
  id: string;
  name: string;
  reporting: number | null;
  reportingLabel: string | null;
  totalVotes: number;
  candidates: ElectionCandidate[];
};

export type ElectionResultsPayload = {
  status: "live" | "stale" | "waiting" | "error";
  electionName: string;
  electionDate: string;
  generatedAt: string;
  sourceUpdatedAt: string | null;
  sourceUrl: string;
  message: string | null;
  contests: ElectionContest[];
};

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const firstValue = (record: JsonRecord, keys: string[]): unknown => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const textValue = (record: JsonRecord, keys: string[], fallback = "") => {
  const value = firstValue(record, keys);
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : fallback;
};

const numericValue = (record: JsonRecord, keys: string[], fallback = 0) => {
  const raw = firstValue(record, keys);
  const value = typeof raw === "string" ? Number(raw.replaceAll(",", "")) : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const booleanValue = (record: JsonRecord, keys: string[]) => {
  const raw = firstValue(record, keys);
  return raw === true || raw === 1 || raw === "1" || raw === "true";
};

const arrayValue = (record: JsonRecord, keys: string[]) => {
  const value = firstValue(record, keys);
  return Array.isArray(value) ? value : [];
};

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || crypto.randomUUID();

const isStatewideContest = (contest: JsonRecord) => {
  const explicit = firstValue(contest, ["statewide", "isStatewide", "is_statewide"]);
  if (explicit !== undefined) return explicit === true || explicit === 1 || explicit === "1";

  const district = textValue(contest, ["district", "districtName", "district_name"]);
  const jurisdiction = textValue(contest, ["jurisdiction", "scope", "geography"]).toLowerCase();
  const office = textValue(contest, ["name", "contestName", "contest_name", "office", "title"]).toLowerCase();

  if (jurisdiction.includes("statewide") || jurisdiction === "florida") return true;
  if (district && !/statewide|florida/i.test(district)) return false;

  return [
    "united states senator",
    "u.s. senator",
    "us senator",
    "governor",
    "attorney general",
    "chief financial officer",
    "commissioner of agriculture",
    "constitutional amendment",
  ].some((label) => office.includes(label));
};

export function normalizeElectionResults(raw: unknown, sourceUrl: string): ElectionResultsPayload {
  if (!isRecord(raw)) throw new Error("Official results feed returned an unsupported document.");

  const election = isRecord(raw.election) ? raw.election : raw;
  const rawContests = arrayValue(raw, ["contests", "races", "results"]);
  const contests = rawContests
    .filter(isRecord)
    .filter(isStatewideContest)
    .map((contest): ElectionContest | null => {
      const name = textValue(contest, ["name", "contestName", "contest_name", "office", "title"]);
      if (!name) return null;

      const rawCandidates = arrayValue(contest, ["candidates", "choices", "options", "results"]);
      const candidateRows = rawCandidates
        .filter(isRecord)
        .map((candidate) => ({
          record: candidate,
          name: textValue(candidate, ["name", "candidateName", "candidate_name", "choice", "label"]),
          party: textValue(candidate, ["party", "partyCode", "party_code", "politicalParty"], "—").toUpperCase(),
          votes: Math.trunc(numericValue(candidate, ["votes", "voteTotal", "vote_total", "totalVotes", "total"])),
        }))
        .filter((candidate) => candidate.name);

      const totalVotes = candidateRows.reduce((sum, candidate) => sum + candidate.votes, 0);
      const candidates = candidateRows
        .map((candidate): ElectionCandidate => ({
          id: textValue(candidate.record, ["id", "candidateId", "candidate_id"], slug(`${name}-${candidate.name}`)),
          name: candidate.name,
          party: candidate.party,
          votes: candidate.votes,
          percentage: totalVotes ? (candidate.votes / totalVotes) * 100 : 0,
          winner: booleanValue(candidate.record, ["winner", "isWinner", "is_winner", "called"]),
        }))
        .sort((a, b) => b.votes - a.votes);

      const reporting = numericValue(contest, ["reportingPercent", "reporting_percent", "percentReporting"], -1);
      const precinctsReporting = numericValue(contest, ["precinctsReporting", "precincts_reporting"], -1);
      const totalPrecincts = numericValue(contest, ["totalPrecincts", "total_precincts"], -1);
      const normalizedReporting = reporting >= 0
        ? Math.min(100, reporting)
        : precinctsReporting >= 0 && totalPrecincts > 0
          ? Math.min(100, (precinctsReporting / totalPrecincts) * 100)
          : null;
      const reportingLabel = precinctsReporting >= 0 && totalPrecincts > 0
        ? `${Math.trunc(precinctsReporting)} of ${Math.trunc(totalPrecincts)} precincts`
        : normalizedReporting === null
          ? null
          : `${normalizedReporting.toFixed(1)}% reporting`;

      return {
        id: textValue(contest, ["id", "contestId", "contest_id"], slug(name)),
        name,
        reporting: normalizedReporting,
        reportingLabel,
        totalVotes,
        candidates,
      };
    })
    .filter((contest): contest is ElectionContest => contest !== null && contest.candidates.length > 0);

  return {
    status: contests.length ? "live" : "waiting",
    electionName: textValue(election, ["name", "electionName", "election_name"], "Florida August 2026 Primary Election"),
    electionDate: textValue(election, ["date", "electionDate", "election_date"], "2026-08-18"),
    generatedAt: new Date().toISOString(),
    sourceUpdatedAt: textValue(raw, ["updatedAt", "updated_at", "lastUpdated", "last_updated"]) || null,
    sourceUrl,
    message: contests.length ? null : "Official statewide results have not started reporting.",
    contests,
  };
}

export function waitingElectionResults(sourceUrl: string, message: string): ElectionResultsPayload {
  return {
    status: "waiting",
    electionName: "Florida August 2026 Primary Election",
    electionDate: "2026-08-18",
    generatedAt: new Date().toISOString(),
    sourceUpdatedAt: null,
    sourceUrl,
    message,
    contests: [],
  };
}
