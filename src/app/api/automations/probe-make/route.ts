// TEMPORARY probe route — inspect Make's API response shape for last-run data.
// Admin-only (returns 401 without a session). Runs server-side, where Vercel
// injects MAKE_API_TOKEN; the token is NEVER returned. Hit this once on
// production while logged in, read the JSON, then it gets deleted as part of
// the "populate Last Runtime" PR. Do NOT keep this around.
//
// Pass 2: the scenario object has no last-run field, and the /logs endpoint is
// the source (200, shape `{ scenarioLogs: [...] }`). This scans up to 100
// scenarios, counts how many have any logs, and returns a couple of real log
// entries so we can see the timestamp field + how populated the column will be.

import { NextResponse } from "next/server";
import { getOptionalAuth } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface MakeScenario {
  id?: number | string;
  name?: string;
  isActive?: boolean;
}

export async function GET() {
  const user = await getOptionalAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.MAKE_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "MAKE_API_TOKEN not set" }, { status: 500 });
  }
  const zone = process.env.MAKE_ZONE || "us1";
  const org = process.env.MAKE_ORG_ID || "1193307";
  const headers = { Authorization: `Token ${token}`, Accept: "application/json" };

  // Grab up to 100 scenarios (representative of the ~113 total).
  const sres = await fetch(
    `https://${zone}.make.com/api/v2/scenarios?organizationId=${org}&pg[limit]=100`,
    { headers },
  );
  const sjson = (await sres.json().catch(() => ({}))) as {
    scenarios?: MakeScenario[];
  };
  const scenarios = sjson.scenarios ?? [];

  let scanned = 0;
  let withLogs = 0;
  let activeScanned = 0;
  let activeWithLogs = 0;
  const samples: unknown[] = [];

  for (const s of scenarios) {
    if (s.id == null) continue;
    scanned += 1;
    if (s.isActive) activeScanned += 1;

    const lres = await fetch(
      `https://${zone}.make.com/api/v2/scenarios/${s.id}/logs?pg[limit]=1`,
      { headers },
    );
    if (lres.ok) {
      const lj = (await lres.json().catch(() => ({}))) as {
        scenarioLogs?: Record<string, unknown>[];
      };
      const logs = lj.scenarioLogs ?? [];
      if (logs.length > 0) {
        withLogs += 1;
        if (s.isActive) activeWithLogs += 1;
        if (samples.length < 3) {
          samples.push({
            scenarioId: s.id,
            name: s.name,
            isActive: s.isActive,
            logEntryFields: Object.keys(logs[0]),
            logEntry: logs[0],
          });
        }
      }
    }
    // Light throttle to stay under rate limits across ~100 calls.
    await new Promise((r) => setTimeout(r, 40));
  }

  return NextResponse.json({
    scanned,
    withLogs,
    activeScanned,
    activeWithLogs,
    samples,
  });
}
