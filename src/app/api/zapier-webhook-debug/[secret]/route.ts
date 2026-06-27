// =============================================================
// TEMPORARY: PUBLIC Zapier webhook ingest (debug)
// =============================================================
// Receives whatever Zapier's "New Zap Error" monitor Zap POSTs here and stores
// the raw + parsed payload so we can inspect it in the viewer page
// (/automations/zapier-webhook-debug). Purpose: confirm whether the payload
// includes the erroring Zap's ID / link or only its title.
//
// PUBLIC by necessity (Zapier has no login) — guarded only by the unguessable
// secret path segment. It is exempted from the auth proxy (see src/proxy.ts),
// the same way the Vercel cron routes are. Always returns 200 so Zapier marks
// the webhook action successful. Delete this whole folder when done.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  WEBHOOK_DEBUG_SECRET,
  appendCapture,
} from "@/lib/automations/webhook-debug";

export const dynamic = "force-dynamic";

/** Headers we never want to persist. */
const REDACT = new Set(["authorization", "cookie", "set-cookie"]);

function collectHeaders(request: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    out[key] = REDACT.has(key.toLowerCase()) ? "[redacted]" : value;
  });
  return out;
}

function collectQuery(request: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ secret: string }> },
) {
  const { secret } = await params;
  if (secret !== WEBHOOK_DEBUG_SECRET) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contentType = request.headers.get("content-type");
  const rawBody = await request.text();

  // Try JSON.
  let parsed: unknown | null = null;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    parsed = null;
  }

  // Try form-encoded (Zapier "Webhooks" can POST as form data).
  let form: Record<string, string> | null = null;
  if (
    contentType?.includes("application/x-www-form-urlencoded") &&
    rawBody
  ) {
    form = {};
    new URLSearchParams(rawBody).forEach((value, key) => {
      form![key] = value;
    });
  }

  await appendCapture({
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    method: "POST",
    query: collectQuery(request),
    contentType,
    headers: collectHeaders(request),
    rawBody,
    parsed,
    form,
  });

  return NextResponse.json({ ok: true });
}

// A GET makes it easy to confirm the URL is reachable from a browser without
// recording noise. It does NOT expose captured data (that's the auth-gated
// viewer's job).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ secret: string }> },
) {
  const { secret } = await params;
  if (secret !== WEBHOOK_DEBUG_SECRET) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    hint: "Live. POST a Zapier webhook here; view captures in Motherboard at /automations/zapier-webhook-debug.",
  });
}
