// =============================================================
// TEMPORARY inspector — Make error-data shape discovery
// =============================================================
// GET /api/automations/inspect-errors[?scenarioId=NNN]
//
// Dumps RAW Make API responses so we can see the exact shape of error data
// (how an errored execution is flagged, where the message lives) BEFORE writing
// the capture parser. Admin-only (logged-in). Read-only; hits Make only.
//
// ⚠️ THROWAWAY: delete this route once the Make error capture is built. It
// exists purely to reveal the live response shape (same approach used to
// confirm the Zapier error webhook).
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { getOptionalAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { automations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ZONE = process.env.MAKE_ZONE || "us1";

function makeHeaders(): HeadersInit {
  return {
    Authorization: `Token ${process.env.MAKE_API_TOKEN}`,
    Accept: "application/json",
  };
}

/** Fetch a URL and return its raw parsed body (or text) + status, never throws. */
async function raw(url: string) {
  try {
    const res = await fetch(url, { headers: makeHeaders() });
    const text = await res.text();
    let body: unknown = text.slice(0, 4000);
    try {
      body = JSON.parse(text);
    } catch {
      /* keep the raw text */
    }
    return { url, status: res.status, ok: res.ok, body };
  } catch (e) {
    return { url, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Pull the numeric scenario id out of a Make editor URL (.../scenarios/<id>/edit). */
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

  // No explicit scenario: scan our stored Make automations and try to find one
  // whose status=3 (error) log filter returns something. One call per scenario.
  // If Make ignores the status param, the first scenario with any logs is used
  // (we still see the raw entry shape either way).
  const scanned: { scenarioId: string; errorLogHit: boolean; status: number | null }[] = [];
  if (!scenarioId) {
    const rows = await db
      .select({ externalUrl: automations.externalUrl })
      .from(automations)
      .where(eq(automations.platform, "make"));
    const ids = rows
      .map((r) => scenarioIdFromUrl(r.externalUrl))
      .filter((v): v is string => !!v);

    let firstWithAny: string | null = null;
    for (const id of ids.slice(0, 30)) {
      const probe = await raw(`${base}/scenarios/${id}/logs?pg[limit]=1&status=3`);
      const body = probe.body as { scenarioLogs?: unknown[] } | undefined;
      const logs = Array.isArray(body?.scenarioLogs) ? body!.scenarioLogs! : [];
      scanned.push({
        scenarioId: id,
        errorLogHit: logs.length > 0,
        status: typeof probe.status === "number" ? probe.status : null,
      });
      if (logs.length > 0) {
        scenarioId = id;
        break;
      }
      if (!firstWithAny) firstWithAny = id;
      await new Promise((r) => setTimeout(r, 60));
    }
    if (!scenarioId) scenarioId = firstWithAny;
  }

  if (!scenarioId) {
    return NextResponse.json({
      note: "No Make scenarios found to inspect.",
      scanned,
    });
  }

  // Dump raw responses for the chosen scenario across the plausible error routes.
  const logsUnfiltered = await raw(`${base}/scenarios/${scenarioId}/logs?pg[limit]=10`);
  const logsErrorFiltered = await raw(
    `${base}/scenarios/${scenarioId}/logs?pg[limit]=10&status=3`,
  );
  const dlq = await raw(`${base}/dlqs?scenarioId=${scenarioId}`);

  // Grab a first execution id from the logs to fetch its detail (where the
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
    note: "TEMP inspector — raw Make responses. Paste this entire JSON back to Claude; the route will then be removed.",
    inspectedScenarioId: scenarioId,
    scanned,
    logsUnfiltered,
    logsErrorFiltered,
    dlq,
    executionDetail,
  });
}
