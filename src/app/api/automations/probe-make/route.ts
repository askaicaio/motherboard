// TEMPORARY probe route — inspect Make's API response shape for last-run data.
// Admin-only (returns 401 without a session). Runs server-side, where Vercel
// injects MAKE_API_TOKEN; the token is NEVER returned. Hit this once on
// production while logged in, read the JSON, then it gets deleted as part of
// the "populate Last Runtime" PR. Do NOT keep this around.

import { NextResponse } from "next/server";
import { getOptionalAuth } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface MakeScenario {
  id?: number | string;
  name?: string;
  isActive?: boolean;
  [k: string]: unknown;
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

  const out: Record<string, unknown> = { zone, org };

  // 1) List scenarios — inspect ALL fields (maybe last-run is already here).
  const sres = await fetch(
    `https://${zone}.make.com/api/v2/scenarios?organizationId=${org}&pg[limit]=20`,
    { headers },
  );
  out.listStatus = sres.status;
  const sjson = (await sres.json().catch(() => ({}))) as {
    scenarios?: MakeScenario[];
  };
  const scenarios = sjson.scenarios ?? [];
  // Prefer an ACTIVE scenario (more likely to have run history).
  const target = scenarios.find((s) => s.isActive) ?? scenarios[0];
  out.scenarioCount = scenarios.length;
  out.scenarioFields = target ? Object.keys(target) : [];
  out.scenarioSample = target ?? null;

  const id = target?.id;
  if (id != null) {
    // 2) Scenario detail — sometimes richer than the list row.
    const dres = await fetch(`https://${zone}.make.com/api/v2/scenarios/${id}`, {
      headers,
    });
    out.detailStatus = dres.status;
    out.detailSample = await dres.json().catch(() => ({}));

    // 3) Logs endpoint — the brief's suggested execution-history source.
    const lres = await fetch(
      `https://${zone}.make.com/api/v2/scenarios/${id}/logs?pg[limit]=3`,
      { headers },
    );
    out.logsStatus = lres.status;
    out.logsSample = await lres.json().catch(() => ({}));

    // 4) Executions endpoint — try it too, in case it's the right one.
    const eres = await fetch(
      `https://${zone}.make.com/api/v2/scenarios/${id}/executions?pg[limit]=3`,
      { headers },
    );
    out.executionsStatus = eres.status;
    out.executionsSample = await eres.json().catch(() => ({}));
  }

  return NextResponse.json(out);
}
