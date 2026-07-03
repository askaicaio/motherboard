// =============================================================
// TEMPORARY inspector — Make error-data shape discovery (HUNT)
// =============================================================
// GET /api/automations/inspect-errors[?scenarioId=NNN]
//
// Dumps RAW Make API responses so we can see the exact shape of an ERRORED
// execution (how it's flagged + where the message lives) BEFORE writing the
// capture parser. Admin-only. Read-only. Gentle (delays + 429 backoff).
//
// What we already learned: a scenarioLogs entry has `status` (1=success), a
// short `id` + a prefixed `imtId`, and a `timestamp`. The executions endpoint
// wants the SHORT `id` (imtId 400s). DLQ is out (token lacks dlqs:read).
//
// This version HUNTS: it scans recently-run Make scenarios for a status=3
// (error) hit and dumps the first real error entry + its execution detail (via
// the short id). Also dumps a chosen scenario's logs + first execution detail.
//
// ⚠️ THROWAWAY: delete this route once the Make error capture is built.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { getOptionalAuth } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { automations } from "@/lib/db/schema";
import { and, desc, eq, isNotNull } from "drizzle-orm";

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
        await sleep(5000);
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

function scenarioIdFromUrl(u: string): string | null {
  const m = u.match(/\/scenarios\/(\d+)\//);
  return m ? m[1] : null;
}

type LogEntry = Record<string, unknown>;
function firstLog(body: unknown): LogEntry | null {
  const b = body as { scenarioLogs?: LogEntry[] } | undefined;
  return Array.isArray(b?.scenarioLogs) && b!.scenarioLogs!.length > 0
    ? b!.scenarioLogs![0]
    : null;
}

/** First DLQ entry from whatever key the list uses (unknown wrapper — try the
 *  common ones + a bare array). */
function firstDlqEntry(body: unknown): LogEntry | null {
  if (Array.isArray(body)) return (body[0] as LogEntry) ?? null;
  const b = body as Record<string, unknown> | undefined;
  if (!b) return null;
  for (const key of ["dlqs", "incompleteExecutions", "data", "items"]) {
    const arr = b[key];
    if (Array.isArray(arr) && arr.length > 0) return arr[0] as LogEntry;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.MAKE_API_TOKEN) {
    return NextResponse.json({ error: "MAKE_API_TOKEN not set" }, { status: 400 });
  }

  const base = `https://${ZONE}.make.com/api/v2`;
  const paramId = request.nextUrl.searchParams.get("scenarioId");

  // Candidate scenarios to hunt: recently-run first (lastRunAt not null), which
  // are the ones with logs; fall back to any make automations if none.
  let rows = await db
    .select({ externalUrl: automations.externalUrl })
    .from(automations)
    .where(and(eq(automations.platform, "make"), isNotNull(automations.lastRunAt)))
    .orderBy(desc(automations.lastRunAt))
    .limit(12);
  if (rows.length === 0) {
    rows = await db
      .select({ externalUrl: automations.externalUrl })
      .from(automations)
      .where(eq(automations.platform, "make"))
      .limit(12);
  }
  const candidateIds = rows
    .map((r) => scenarioIdFromUrl(r.externalUrl))
    .filter((v): v is string => !!v);

  // HUNT for a status=3 (error) entry across the candidates.
  const hunted: { scenarioId: string; errorCount: number; status?: number }[] = [];
  let errorScenarioId: string | null = null;
  let errorEntry: LogEntry | null = null;
  for (const id of candidateIds) {
    const probe = await raw(`${base}/scenarios/${id}/logs?pg[limit]=3&status=3`);
    const body = probe.body as { scenarioLogs?: LogEntry[] } | undefined;
    const errs = Array.isArray(body?.scenarioLogs) ? body!.scenarioLogs! : [];
    hunted.push({ scenarioId: id, errorCount: errs.length, status: probe.status });
    if (errs.length > 0) {
      errorScenarioId = id;
      errorEntry = errs[0];
      break;
    }
    await sleep(1200);
  }

  // Scenario to dump a general sample from: explicit param > the error one > first candidate.
  const sampleScenarioId = paramId || errorScenarioId || candidateIds[0] || null;

  await sleep(1000);
  const sampleLogs = sampleScenarioId
    ? await raw(`${base}/scenarios/${sampleScenarioId}/logs?pg[limit]=5`)
    : { note: "no scenario to sample" };
  await sleep(1000);
  const sampleFirst = firstLog((sampleLogs as { body?: unknown }).body);
  const sampleExecDetail =
    sampleScenarioId && sampleFirst?.id
      ? await raw(
          `${base}/scenarios/${sampleScenarioId}/executions/${String(sampleFirst.id)}`,
        )
      : { note: "no short id on first sample log entry", sampleFirst };

  // If we found a real error, dump its execution detail via the SHORT id.
  let errorExecDetail: unknown = { note: "no error entry found while hunting" };
  if (errorScenarioId && errorEntry?.id) {
    await sleep(1000);
    errorExecDetail = await raw(
      `${base}/scenarios/${errorScenarioId}/executions/${String(errorEntry.id)}`,
    );
  }

  // DLQ (incomplete executions) — the likely MESSAGE source (`reason`). Requires
  // the dlqs:read scope (was 401 before). Probe org-wide, by org id, and by the
  // sample scenario to see the shape + whether it surfaces real errors. If org
  // -wide returns entries, also dump the first one's logs (the failure detail).
  const orgId = process.env.MAKE_ORG_ID || "1193307";
  await sleep(1000);
  const dlqOrgWide = await raw(`${base}/dlqs`);
  await sleep(1000);
  const dlqByOrg = await raw(`${base}/dlqs?organizationId=${orgId}`);
  await sleep(1000);
  const dlqByScenario = sampleScenarioId
    ? await raw(`${base}/dlqs?scenarioId=${sampleScenarioId}`)
    : { note: "no sample scenario" };

  // If any DLQ list returned entries, dump the first entry's detail + logs.
  const firstDlq =
    firstDlqEntry((dlqOrgWide as { body?: unknown }).body) ??
    firstDlqEntry((dlqByOrg as { body?: unknown }).body) ??
    firstDlqEntry((dlqByScenario as { body?: unknown }).body);
  let dlqDetail: unknown = { note: "no DLQ entries found to detail" };
  if (firstDlq?.id) {
    await sleep(1000);
    const detail = await raw(`${base}/dlqs/${String(firstDlq.id)}`);
    await sleep(1000);
    const logs = await raw(`${base}/dlqs/${String(firstDlq.id)}/logs`);
    dlqDetail = { dlqEntry: firstDlq, detail, logs };
  }

  return NextResponse.json({
    note: "TEMP inspector (hunt+dlq) — raw Make responses. Paste this entire JSON back to Claude.",
    hunted,
    errorScenarioId,
    errorEntry,
    errorExecDetail,
    sampleScenarioId,
    sampleLogs,
    sampleExecDetail,
    dlqOrgWide,
    dlqByOrg,
    dlqByScenario,
    dlqDetail,
  });
}
