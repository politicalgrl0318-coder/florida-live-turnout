type JsonRecord = Record<string, unknown>;

interface FeedEnv {
  ELECTION_WATCH_INFO_URL?: string;
  ELECTION_WATCH_VOTES_URL?: string;
  ELECTION_WATCH_PUBLIC_URL?: string;
  RESULTS_REFRESH_SECONDS?: string;
}

interface CandidateResult {
  id: string;
  name: string;
  party: string | null;
  votes: number;
  voteShare: number;
}

interface ContestResult {
  id: string;
  name: string;
  candidates: CandidateResult[];
  totalVotes: number;
  precinctsReporting: number | null;
  totalPrecincts: number | null;
  reportingPercent: number | null;
}

interface Snapshot {
  contests: ContestResult[];
  sourceTimestamp: string | null;
  verifiedAt: string;
}

const DEFAULT_INFO_URL =
  "https://flelectionfiles.floridados.gov/enightfilespublic/20260818_ElecResultsFL_PipeDlm_Info.txt";
const DEFAULT_VOTES_URL =
  "https://flelectionfiles.floridados.gov/enightfilespublic/20260818_ElecResultsFL_PipeDlm_Votes.txt";
const DEFAULT_PUBLIC_URL =
  "https://floridaelectionwatch.gov/";
const DEFAULT_RESULTS_PAGES = [
  "https://floridaelectionwatch.gov/FederalOffices/USSenator",
  "https://floridaelectionwatch.gov/FederalOffices/USRepresentative",
  "https://floridaelectionwatch.gov/StateOffices/Governor",
  "https://floridaelectionwatch.gov/StateOffices/ChiefFinancialOfficer",
  "https://floridaelectionwatch.gov/StateOffices/CommissionerOfAgriculture",
  "https://floridaelectionwatch.gov/DistrictOffices/StateSenator",
  "https://floridaelectionwatch.gov/DistrictOffices/StateRepresentative",
  "https://floridaelectionwatch.gov/JudicialOffices/CircuitCourt",
];
const MAX_FEED_BYTES = 12 * 1024 * 1024;

let cached: Snapshot | null = null;
let cacheExpiresAt = 0;

function json(body: JsonRecord, refreshSeconds: number, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": `public, max-age=0, s-maxage=${refreshSeconds}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function readText(response: Response): Promise<string> {
  if (!response.ok) throw new Error(`Official feed returned HTTP ${response.status}.`);
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_FEED_BYTES) {
    throw new Error("Official feed exceeds the size limit.");
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_FEED_BYTES) {
    throw new Error("Official feed exceeds the size limit.");
  }
  return text;
}

function rows(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const unwrapped = line.startsWith("[") && line.endsWith("]")
        ? line.slice(1, -1)
        : line;
      return unwrapped.split("|").map((field) => field.trim());
    });
}

function partyFromElectionType(value: string): string | null {
  if (/democrat/i.test(value)) return "DEM";
  if (/republican/i.test(value)) return "REP";
  if (/no party|nonpartisan/i.test(value)) return "NPA";
  return null;
}

function shouldDisplayRace(name: string): boolean {
  return /(u\.?s\.? senator|united states senator|u\.?s\.? representative|united states representative|governor|attorney general|chief financial officer|commissioner of agriculture|state senator|state representative|circuit judge|district court of appeal|public service commission)/i.test(name);
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseResultsPage(html: string): ContestResult[] {
  const contests: ContestResult[] = [];
  const contestPattern = /<div[^>]*class="[^"]*titleDescription[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<strong>\s*([^<]+?)\s*<\/strong>[\s\S]*?\/ContestResultsByCounty\/(\d+)[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/gi;
  let contestMatch: RegExpExecArray | null;

  while ((contestMatch = contestPattern.exec(html)) !== null) {
    const office = decodeHtml(contestMatch[1]);
    const electionType = decodeHtml(contestMatch[2]);
    const id = contestMatch[3];
    const table = contestMatch[4];
    const candidates: CandidateResult[] = [];
    const rowPattern = /<tr[^>]*class="[^"]*grid-row[^"]*"[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>[\s\S]*?<span>\s*([\d,]+)\s*<\/span>[\s\S]*?<div[^>]*class="[^"]*progressbar[^"]*"[^>]*>\s*([\d.]+)%\s*<\/div>[\s\S]*?<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowPattern.exec(table)) !== null) {
      const votes = Number(rowMatch[3].replace(/,/g, ""));
      const voteShare = Number(rowMatch[4]);
      if (!Number.isFinite(votes) || !Number.isFinite(voteShare)) continue;
      candidates.push({
        id: `${id}-${candidates.length + 1}`,
        name: decodeHtml(rowMatch[1]),
        party: decodeHtml(rowMatch[2]) || partyFromElectionType(electionType),
        votes,
        voteShare,
      });
    }

    if (!candidates.length) continue;
    const totalVotes = candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
    contests.push({
      id,
      name: electionType ? `${office} — ${electionType}` : office,
      candidates: candidates.sort((a, b) => b.votes - a.votes),
      totalVotes,
      precinctsReporting: null,
      totalPrecincts: null,
      reportingPercent: null,
    });
  }

  return contests;
}

async function fetchResultsPages(): Promise<{ contests: ContestResult[]; sourceTimestamp: string | null }> {
  const responses = await Promise.all(DEFAULT_RESULTS_PAGES.map((url) =>
    fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; 305DataGirl/1.0; +https://florida-live-turnout.politicalgrl0318.workers.dev/)",
      },
    }).catch(() => null)
  ));

  const contests = new Map<string, ContestResult>();
  let sourceTimestamp: string | null = null;
  for (const response of responses) {
    if (!response?.ok) continue;
    sourceTimestamp = response.headers.get("last-modified") ?? response.headers.get("date") ?? sourceTimestamp;
    const html = await readText(response);
    for (const contest of parseResultsPage(html)) contests.set(contest.id, contest);
  }
  return { contests: [...contests.values()].sort((a, b) => a.name.localeCompare(b.name)), sourceTimestamp };
}

function parseFeeds(infoText: string, votesText: string): ContestResult[] {
  const races = new Map<string, { name: string; electionType: string }>();
  const candidates = new Map<string, { raceId: string; name: string }>();
  const precinctTotals = new Map<string, number>();

  for (const row of rows(infoText)) {
    const kind = row[0]?.toLowerCase();
    if (kind === "r" && row.length >= 6) {
      races.set(row[5], { name: row[3], electionType: row[4] });
    } else if (kind === "c" && row.length >= 7) {
      const name = [row[5], row[4]].filter(Boolean).join(" ").trim();
      candidates.set(row[6], { raceId: row[3], name });
    } else if (kind === "p" && row.length >= 6) {
      const value = Number(row[5].replace(/,/g, ""));
      if (Number.isFinite(value)) precinctTotals.set(`${row[3]}:${row[4]}`, value);
    }
  }

  const voteTotals = new Map<string, number>();
  const reportingByRaceUnit = new Map<string, number>();

  for (const row of rows(votesText)) {
    if (row[0]?.toLowerCase() !== "v" || row.length < 9) continue;
    const raceId = row[4];
    const unitId = row[5];
    const candidateId = row[7];
    const votes = Number(row[8].replace(/,/g, ""));
    const reporting = Number(row[6].replace(/,/g, ""));
    if (!Number.isFinite(votes)) continue;
    const key = `${raceId}:${candidateId}`;
    voteTotals.set(key, (voteTotals.get(key) ?? 0) + votes);
    if (Number.isFinite(reporting)) {
      const unitKey = `${raceId}:${unitId}`;
      reportingByRaceUnit.set(unitKey, Math.max(reportingByRaceUnit.get(unitKey) ?? 0, reporting));
    }
  }

  const output: ContestResult[] = [];
  for (const [raceId, race] of races) {
    if (!shouldDisplayRace(race.name)) continue;
    const raceCandidates = [...candidates.entries()]
      .filter(([, candidate]) => candidate.raceId === raceId)
      .map(([candidateId, candidate]) => ({
        id: candidateId,
        name: candidate.name,
        party: partyFromElectionType(race.electionType),
        votes: voteTotals.get(`${raceId}:${candidateId}`) ?? 0,
        voteShare: 0,
      }));
    if (!raceCandidates.length) continue;

    const totalVotes = raceCandidates.reduce((sum, candidate) => sum + candidate.votes, 0);
    for (const candidate of raceCandidates) {
      candidate.voteShare = totalVotes ? candidate.votes / totalVotes * 100 : 0;
    }

    const racePrecinctEntries = [...precinctTotals.entries()].filter(([key]) => key.startsWith(`${raceId}:`));
    const totalPrecincts = racePrecinctEntries.reduce((sum, [, count]) => sum + count, 0);
    const precinctsReporting = [...reportingByRaceUnit.entries()]
      .filter(([key]) => key.startsWith(`${raceId}:`))
      .reduce((sum, [, count]) => sum + count, 0);

    output.push({
      id: raceId,
      name: race.electionType ? `${race.name} — ${race.electionType}` : race.name,
      candidates: raceCandidates.sort((a, b) => b.votes - a.votes),
      totalVotes,
      precinctsReporting: totalPrecincts ? precinctsReporting : null,
      totalPrecincts: totalPrecincts || null,
      reportingPercent: totalPrecincts
        ? Math.min(100, precinctsReporting / totalPrecincts * 100)
        : null,
    });
  }

  return output.sort((a, b) => a.name.localeCompare(b.name));
}

export async function handleOfficialElectionResults(env: FeedEnv): Promise<Response> {
  const refreshSeconds = Math.max(5, Number.parseInt(env.RESULTS_REFRESH_SECONDS ?? "30", 10) || 30);
  const publicUrl = env.ELECTION_WATCH_PUBLIC_URL ?? DEFAULT_PUBLIC_URL;
  const infoUrl = env.ELECTION_WATCH_INFO_URL ?? DEFAULT_INFO_URL;
  const votesUrl = env.ELECTION_WATCH_VOTES_URL ?? DEFAULT_VOTES_URL;

  if (cached && Date.now() < cacheExpiresAt) {
    return json({ status: "live", ...cached, sourceUrl: publicUrl, refreshSeconds }, refreshSeconds);
  }

  try {
    const [infoResponse, votesResponse] = await Promise.all([
      fetch(infoUrl, { headers: { Accept: "text/plain, application/octet-stream;q=0.9" } }),
      fetch(votesUrl, { headers: { Accept: "text/plain, application/octet-stream;q=0.9" } }),
    ]);
    const [infoText, votesText] = await Promise.all([
      readText(infoResponse),
      readText(votesResponse),
    ]);
    const contests = parseFeeds(infoText, votesText);
    if (!contests.length) {
      return json({
        status: "waiting",
        message: "Florida Election Watch is available, but the selected contests have not been published.",
        contests: [],
        sourceUrl: publicUrl,
        refreshSeconds,
      }, refreshSeconds);
    }

    let liveContests = contests;
    let hasVotes = liveContests.some((contest) => contest.totalVotes > 0);
    let sourceTimestamp = votesResponse.headers.get("last-modified");
    if (!hasVotes) {
      const pageResults = await fetchResultsPages();
      if (pageResults.contests.some((contest) => contest.totalVotes > 0)) {
        liveContests = pageResults.contests;
        hasVotes = true;
        sourceTimestamp = pageResults.sourceTimestamp;
      }
    }
    if (!hasVotes) {
      return json({
        status: "waiting",
        message: "Official contest information is available. Waiting for Florida Election Watch to publish vote totals.",
        contests,
        sourceUrl: publicUrl,
        sourceTimestamp,
        refreshSeconds,
      }, refreshSeconds);
    }

    cached = {
      contests: liveContests,
      sourceTimestamp,
      verifiedAt: new Date().toISOString(),
    };
    cacheExpiresAt = Date.now() + refreshSeconds * 1000;
    return json({ status: "live", ...cached, sourceUrl: publicUrl, refreshSeconds }, refreshSeconds);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The official feed is unavailable.";
    if (cached) {
      return json({ status: "stale", message, ...cached, sourceUrl: publicUrl, refreshSeconds }, refreshSeconds);
    }
    return json({ status: "error", message, contests: [], sourceUrl: publicUrl, refreshSeconds }, refreshSeconds, 502);
  }
}
