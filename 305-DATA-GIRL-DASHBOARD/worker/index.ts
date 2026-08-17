/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleOfficialElectionResults } from "./election-results";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  ELECTION_WATCH_RESULTS_URL?: string;
  ELECTION_WATCH_PUBLIC_URL?: string;
  RESULTS_REFRESH_SECONDS?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type JsonRecord = Record<string, unknown>;

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

interface ResultsSnapshot {
  contests: ContestResult[];
  sourceTimestamp: string | null;
  verifiedAt: string;
}

const MAX_RESULTS_BYTES = 2 * 1024 * 1024;
let lastVerifiedSnapshot: ResultsSnapshot | null = null;
let snapshotExpiresAt = 0;

const objectValue = (value: unknown): JsonRecord | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;

const firstValue = (record: JsonRecord, keys: string[]): unknown => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const textValue = (record: JsonRecord, keys: string[]): string | null => {
  const value = firstValue(record, keys);
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const numberValue = (record: JsonRecord, keys: string[]): number | null => {
  const value = firstValue(record, keys);
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[,%]/g, "")) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const arrayValue = (record: JsonRecord, keys: string[]): unknown[] => {
  const value = firstValue(record, keys);
  return Array.isArray(value) ? value : [];
};

function findContestRecords(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) return payload.map(objectValue).filter((value): value is JsonRecord => Boolean(value));
  const root = objectValue(payload);
  if (!root) return [];
  for (const key of ["contests", "Contests", "races", "Races", "results", "Results"]) {
    if (Array.isArray(root[key])) return (root[key] as unknown[]).map(objectValue).filter((value): value is JsonRecord => Boolean(value));
  }
  for (const key of ["election", "Election", "data", "Data"]) {
    const nested = objectValue(root[key]);
    if (nested) {
      const records = findContestRecords(nested);
      if (records.length) return records;
    }
  }
  return [];
}

function isStatewideContest(contest: JsonRecord): boolean {
  const scope = textValue(contest, ["scope", "Scope", "districtType", "DistrictType", "jurisdiction", "Jurisdiction"]);
  const district = textValue(contest, ["district", "District", "districtName", "DistrictName"]);
  const statewide = firstValue(contest, ["statewide", "Statewide", "isStatewide", "IsStatewide"]);
  if (statewide === true || statewide === 1 || String(statewide).toLowerCase() === "true") return true;
  if (scope && /statewide|federal|state of florida/i.test(scope)) return true;
  if (district && /statewide|state of florida|united states/i.test(district)) return true;
  return false;
}

function normalizeContest(contest: JsonRecord, index: number): ContestResult | null {
  const name = textValue(contest, ["name", "Name", "contestName", "ContestName", "raceName", "RaceName", "office", "Office"]);
  if (!name) return null;
  const rawCandidates = arrayValue(contest, ["candidates", "Candidates", "choices", "Choices", "results", "Results"]);
  const candidates = rawCandidates.map((raw, candidateIndex): CandidateResult | null => {
    const candidate = objectValue(raw);
    if (!candidate) return null;
    const candidateName = textValue(candidate, ["name", "Name", "candidateName", "CandidateName", "choiceName", "ChoiceName"]);
    const votes = numberValue(candidate, ["votes", "Votes", "voteTotal", "VoteTotal", "totalVotes", "TotalVotes"]);
    if (!candidateName || votes === null) return null;
    return {
      id: textValue(candidate, ["id", "Id", "candidateId", "CandidateId"]) ?? `${index}-${candidateIndex}`,
      name: candidateName,
      party: textValue(candidate, ["party", "Party", "partyName", "PartyName", "partyCode", "PartyCode"]),
      votes,
      voteShare: 0,
    };
  }).filter((candidate): candidate is CandidateResult => Boolean(candidate));
  if (!candidates.length) return null;
  const candidateTotal = candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
  const reportedTotal = numberValue(contest, ["totalVotes", "TotalVotes", "votesCast", "VotesCast"]);
  const totalVotes = reportedTotal !== null && reportedTotal >= candidateTotal ? reportedTotal : candidateTotal;
  candidates.forEach((candidate) => {
    candidate.voteShare = totalVotes > 0 ? candidate.votes / totalVotes * 100 : 0;
  });
  const precinctsReporting = numberValue(contest, ["precinctsReporting", "PrecinctsReporting", "reportedPrecincts", "ReportedPrecincts"]);
  const totalPrecincts = numberValue(contest, ["totalPrecincts", "TotalPrecincts", "precinctsTotal", "PrecinctsTotal"]);
  let reportingPercent = numberValue(contest, ["reportingPercent", "ReportingPercent", "percentReporting", "PercentReporting", "pctReporting"]);
  if (reportingPercent !== null && reportingPercent <= 1) reportingPercent *= 100;
  if (reportingPercent === null && precinctsReporting !== null && totalPrecincts) reportingPercent = precinctsReporting / totalPrecincts * 100;
  return {
    id: textValue(contest, ["id", "Id", "contestId", "ContestId", "raceId", "RaceId"]) ?? String(index),
    name,
    candidates: candidates.sort((a, b) => b.votes - a.votes),
    totalVotes,
    precinctsReporting,
    totalPrecincts,
    reportingPercent: reportingPercent === null ? null : Math.min(reportingPercent, 100),
  };
}

function sourceTimestamp(payload: unknown): string | null {
  const root = objectValue(payload);
  if (!root) return null;
  const value = textValue(root, ["timestamp", "Timestamp", "lastUpdated", "LastUpdated", "updatedAt", "UpdatedAt", "reportingTime", "ReportingTime"]);
  if (value) return value;
  for (const key of ["election", "Election", "data", "Data"]) {
    const nested = objectValue(root[key]);
    if (nested) {
      const nestedValue = sourceTimestamp(nested);
      if (nestedValue) return nestedValue;
    }
  }
  return null;
}

async function readLimitedJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESULTS_BYTES) throw new Error("Official feed exceeds the 2 MB limit.");
  if (!response.body) throw new Error("Official feed returned an empty response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESULTS_BYTES) {
      await reader.cancel();
      throw new Error("Official feed exceeds the 2 MB limit.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function resultsResponse(body: JsonRecord, refreshSeconds: number, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": `public, max-age=0, s-maxage=${refreshSeconds}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function handleElectionResults(env: Partial<Env>): Promise<Response> {
  const refreshSeconds = Math.max(1, Number.parseInt(env.RESULTS_REFRESH_SECONDS ?? "30", 10) || 30);
  const publicUrl = env.ELECTION_WATCH_PUBLIC_URL && /^https:\/\//i.test(env.ELECTION_WATCH_PUBLIC_URL) ? env.ELECTION_WATCH_PUBLIC_URL : null;
  if (!env.ELECTION_WATCH_RESULTS_URL) {
    return resultsResponse({ status: "waiting", message: "The official results feed has not been configured.", contests: [], sourceUrl: publicUrl, refreshSeconds }, refreshSeconds);
  }
  let feedUrl: URL;
  try {
    feedUrl = new URL(env.ELECTION_WATCH_RESULTS_URL);
    if (feedUrl.protocol !== "https:") throw new Error();
  } catch {
    return resultsResponse({ status: "error", message: "The official results feed URL must use HTTPS.", contests: [], sourceUrl: publicUrl, refreshSeconds }, refreshSeconds, 500);
  }
  if (lastVerifiedSnapshot && Date.now() < snapshotExpiresAt) {
    return resultsResponse({ status: "live", ...lastVerifiedSnapshot, sourceUrl: publicUrl, refreshSeconds }, refreshSeconds);
  }
  try {
    const upstream = await fetch(feedUrl, { headers: { Accept: "application/json" }, cf: { cacheTtl: refreshSeconds, cacheEverything: true } });
    if (!upstream.ok) throw new Error(`Official feed returned HTTP ${upstream.status}.`);
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!/application\/json|text\/json/i.test(contentType)) throw new Error("Official feed did not return JSON.");
    const payload = await readLimitedJson(upstream);
    const contests = findContestRecords(payload).filter(isStatewideContest).map(normalizeContest).filter((contest): contest is ContestResult => Boolean(contest));
    if (!contests.length) {
      return resultsResponse({ status: "waiting", message: "The official feed is available, but statewide results have not been published.", contests: [], sourceUrl: publicUrl, sourceTimestamp: sourceTimestamp(payload), refreshSeconds }, refreshSeconds);
    }
    lastVerifiedSnapshot = { contests, sourceTimestamp: sourceTimestamp(payload), verifiedAt: new Date().toISOString() };
    snapshotExpiresAt = Date.now() + refreshSeconds * 1000;
    return resultsResponse({ status: "live", ...lastVerifiedSnapshot, sourceUrl: publicUrl, refreshSeconds }, refreshSeconds);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The official feed is unavailable.";
    if (lastVerifiedSnapshot) {
      return resultsResponse({ status: "stale", message, ...lastVerifiedSnapshot, sourceUrl: publicUrl, refreshSeconds }, refreshSeconds);
    }
    return resultsResponse({ status: "error", message, contests: [], sourceUrl: publicUrl, refreshSeconds }, refreshSeconds, 502);
  }
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/election-results") {
      if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET" } });
      return handleOfficialElectionResults(env ?? {});
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
