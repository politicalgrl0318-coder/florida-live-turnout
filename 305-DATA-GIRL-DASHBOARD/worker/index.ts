/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { normalizeElectionResults, waitingElectionResults } from "../lib/election-results";

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

const DEFAULT_ELECTION_WATCH_URL = "https://floridaelectionwatch.gov/";
const MAX_RESULTS_BYTES = 2_000_000;

async function readBoundedJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_RESULTS_BYTES) throw new Error("Official results feed exceeded the size limit.");
  if (!response.body) throw new Error("Official results feed returned an empty response.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_RESULTS_BYTES) {
      await reader.cancel();
      throw new Error("Official results feed exceeded the size limit.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

const jsonResponse = (body: unknown, status = 200, cacheControl = "no-store") =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": cacheControl,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });

async function electionResults(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const publicUrl = env.ELECTION_WATCH_PUBLIC_URL || DEFAULT_ELECTION_WATCH_URL;
  const feedUrl = env.ELECTION_WATCH_RESULTS_URL?.trim();
  if (!feedUrl) {
    return jsonResponse(waitingElectionResults(
      publicUrl,
      "The live statewide results connector is ready and awaiting the official Florida Election Watch feed.",
    ));
  }

  let parsedFeedUrl: URL;
  try {
    parsedFeedUrl = new URL(feedUrl);
    if (parsedFeedUrl.protocol !== "https:") throw new Error();
  } catch {
    return jsonResponse({
      ...waitingElectionResults(publicUrl, "The configured official results feed is invalid."),
      status: "error",
    }, 503);
  }

  const refreshSeconds = Math.min(300, Math.max(15, Number(env.RESULTS_REFRESH_SECONDS) || 30));
  const cache = caches.default;
  const cacheBase = new URL(request.url);
  cacheBase.search = "";
  cacheBase.pathname = "/__cache/election-results";
  const freshKey = new Request(cacheBase.toString());
  const staleUrl = new URL(cacheBase);
  staleUrl.pathname = "/__cache/election-results-last-good";
  const staleKey = new Request(staleUrl.toString());

  const cached = await cache.match(freshKey);
  if (cached) return cached;

  try {
    const upstream = await fetch(parsedFeedUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "305-Data-Girl-Official-Results/1.0",
      },
      redirect: "follow",
    });
    if (!upstream.ok) throw new Error(`Official results feed returned HTTP ${upstream.status}.`);

    const raw = await readBoundedJson(upstream);
    const payload = normalizeElectionResults(raw, publicUrl);
    const fresh = jsonResponse(payload, 200, `public, max-age=0, s-maxage=${refreshSeconds}`);
    const lastGood = jsonResponse(payload, 200, "public, max-age=0, s-maxage=86400");
    ctx.waitUntil(Promise.all([
      cache.put(freshKey, fresh.clone()),
      cache.put(staleKey, lastGood),
    ]).then(() => undefined));
    return fresh;
  } catch (error) {
    console.error(JSON.stringify({
      event: "election_results_fetch_failed",
      error: error instanceof Error ? error.message : "Unknown error",
      source: parsedFeedUrl.origin,
    }));
    const stale = await cache.match(staleKey);
    if (stale) {
      const payload = await stale.json() as Record<string, unknown>;
      return jsonResponse({
        ...payload,
        status: "stale",
        message: "The official source is temporarily unavailable. Showing the most recent verified snapshot.",
      });
    }
    return jsonResponse({
      ...waitingElectionResults(publicUrl, "The official source is temporarily unavailable. No verified snapshot has been received yet."),
      status: "error",
    }, 503);
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

    if (url.pathname === "/api/election-results") {
      return electionResults(request, env, ctx);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
