// =============================================================
// Long-running fetch wrapper for Anthropic API calls
// =============================================================
// Node.js's built-in fetch (undici) has a default 5-minute headers
// timeout — it will throw `UND_ERR_HEADERS_TIMEOUT` if the server
// hasn't started sending response headers within 5 minutes.
//
// For our Anthropic deep-research calls (Opus 4.7 + adaptive
// thinking + 20 web searches), the response can legitimately take
// 8-12 minutes before headers come back. This wrapper uses a
// custom undici Agent with extended timeouts to allow that.
// =============================================================

import { Agent, fetch as undiciFetch } from "undici";

// 25 minutes — well beyond Vercel's 13-min function limit, so the
// effective timeout becomes whichever fires first (the function
// itself, not the HTTP client).
const TIMEOUT_MS = 25 * 60 * 1000;

const longRunningAgent = new Agent({
  headersTimeout: TIMEOUT_MS,
  bodyTimeout: TIMEOUT_MS,
  // Connection timeout stays short — if we can't reach Anthropic
  // at all, fail fast.
  connect: { timeout: 30 * 1000 },
  // Keep the connection alive for the duration of the request
  keepAliveTimeout: 60 * 1000,
});

/**
 * fetch() with extended timeouts suitable for long Anthropic API calls.
 * Has the same signature as global fetch.
 */
export async function longFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  // undici's fetch signature is mostly compatible with the global
  // RequestInit. Cast through unknown to satisfy TS.
  return undiciFetch(url, {
    ...(init as Record<string, unknown>),
    dispatcher: longRunningAgent,
  } as Parameters<typeof undiciFetch>[1]) as unknown as Response;
}
