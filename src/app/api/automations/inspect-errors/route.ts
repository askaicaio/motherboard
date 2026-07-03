// =============================================================
// TEMPORARY inspector — Make error-data shape discovery (GENTLE)
// =============================================================
// GET /api/automations/inspect-errors[?scenarioId=NNN]
//
// Dumps RAW Make API responses so we can see the exact shape of error data
// (how an errored execution is flagged in the logs, where the message lives)
// BEFORE writing the capture parser. Admin-only. Read-only.
//
// GENTLE: Make's org rate limit is low, so this makes only a handful of calls
// with delays + a 429 backoff (an earlier 30-scenario scan tripped the limit).
// DLQ is intentionally NOT called (the token lacks dlqs:read).
//
// Best used with an errored scenario: /api/automations/inspect-errors?scenarioId=NNN
// (find the id in that automation's Make link: .../scenarios/<id>/edit).
//
// ⚠️ THROWAWAY: delete this route once the Make error capture is built.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { getOptionalAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { automations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ZONE = process.env.MAKE_ZONE || "us1";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeHeaders(): HeadersInit {
  return {
    Authorization: `Token ${process.env.MAKE_API_TOKEN}`,
    Accept: "application/json",
  };
}

/** Fetch a URL, returning its raw parsed body + status. One 429 backoff+retry. */
async function raw(url: string): Promise<{
  url: string;
  status?: number;
  ok?: boolean;
  body?: unknown;
  error?: string;
}> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: makeHeaders() });
      if (res.status === 429 && attempt === 0) {
        await sleep(5000); // rate limited — wait once, then retry
        continue;
      }
      const text = await res.text();
      let body: unknown = text.slice(0, 4000);
      try {
        body = JSON.parse(text);
      } catch {
        /* keep raw text */
      }
      return { url, status: res.status, ok: res.ok, body };
    } catch (e) {
      return { url, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return { url, error: "rate limited (429) after retry" };
}

/** Pull the numeric scenario id from a Make editor URL (.../scenarios/<id>/edit). */
function scenarioIdFromUrl(u: string): string | null {
  const m = u.match(/\/scenarios\/(\d+)\//);
  return m ? m[1] : null;
}

export async function GET(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.MAKE_API_TOKEN) {
    return NextResponse.json({ error: "MAKE_API_TOKEN not set" }, { status: 400 });
  }

  const base = `https://${ZONE}.make.com/api/v2`;
  let scenarioId = request.nextUrl.searchParams.get("scenarioId");

  // No explicit scenario: gently scan a FEW stored Make automations (big delays)
  // to find the first with any logs. This is only to reveal the log-entry shape;
  // for a real ERROR shape, pass ?scenarioId= of a scenario you know errored.
  const scanned: { scenarioId: string; hasLogs: boolean; status?: number }[] = [];
  if (!scenarioId) {
    const rows = await db
      .select({ externalUrl: automations.externalUrl })
      .from(automations)
      .where(eq(automations.platform, "make"));
    const ids = rows
      .map((r) => scenarioIdFromUrl(r.externalUrl))
      .filter((v): v is string => !!v);

    for (const id of ids.slice(0, 5)) {
      const probe = await raw(`${base}/scenarios/${id}/logs?pg[limit]=1`);
      const body = probe.body as { scenarioLogs?: unknown[] } | undefined;
      const hasLogs = Array.isArray(body?.scenarioLogs) && body!.scenarioLogs!.length > 0;
      scanned.push({ scenarioId: id, hasLogs, status: probe.status });
      if (hasLogs) {
        scenarioId = id;
        break;
      }
      await sleep(1500);
    }
    if (!scenarioId && ids.length > 0) scenarioId = ids[0];
  }

  if (!scenarioId) {
    return NextResponse.json({ note: "No Make scenarios found to inspect.", scanned });
  }

  // A few gentle calls for the chosen scenario.
  const logsUnfiltered = await raw(`${base}/scenarios/${scenarioId}/logs?pg[limit]=10`);
  await sleep(1500);
  const logsErrorFiltered = await raw(
    `${base}/scenarios/${scenarioId}/logs?pg[limit]=10&status=3`,
  );
  await sleep(1500);

  // First execution id from the unfiltered logs -> fetch its detail (where the
  // error name/message/module likely live).
  const logsBody = logsUnfiltered.body as
    | { scenarioLogs?: Record<string, unknown>[] }
    | undefined;
  const firstEntry = logsBody?.scenarioLogs?.[0] ?? null;
  const execIdVal = firstEntry
    ? firstEntry.imtId ?? firstEntry.id ?? firstEntry.executionId
    : null;
  const executionDetail =
    execIdVal != null
      ? await raw(`${base}/scenarios/${scenarioId}/executions/${String(execIdVal)}`)
      : { note: "No execution id found in the first log entry.", firstEntry };

  return NextResponse.json({
    note: "TEMP inspector (gentle) — raw Make responses. Paste this entire JSON back to Claude. Tip: for an ERROR shape, re-run with ?scenarioId=<id of a scenario that errored>.",
    inspectedScenarioId: scenarioId,
    scanned,
    logsUnfiltered,
    logsErrorFiltered,
    executionDetail,
  });
}
