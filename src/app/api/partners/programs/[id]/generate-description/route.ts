// POST /api/partners/programs/[id]/generate-description — admin only.
// Drafts a short, benefit-focused marketing blurb for a program using the
// Anthropic API. It ONLY returns the draft — it does not save. The admin
// reviews/edits it and saves via the normal PATCH, so nothing goes live
// without a human. Returns 503 (not 500) when no AI key is configured.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { partnerPrograms } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guard";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function fmtUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("admin");
  const { id } = await params;

  const [program] = await db
    .select()
    .from(partnerPrograms)
    .where(eq(partnerPrograms.id, id))
    .limit(1);

  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "AI isn't configured — set ANTHROPIC_API_KEY to enable draft generation. You can still write the description by hand.",
      },
      { status: 503 },
    );
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

  const system =
    "You write crisp, credible marketing copy for Chief AI Officer (CAIO), a company that runs executive AI-leadership programs. " +
    "Voice: confident, executive, benefit-focused, zero hype. No emojis, no exclamation marks, no clichés like 'unlock' or 'supercharge'. " +
    "Return ONLY the description text — no quotes, no preamble, no markdown.";

  const prompt =
    `Write a 2 sentence marketing description for a program checkout card.\n\n` +
    `Program: ${program.name}\n` +
    `List price: ${fmtUsd(program.listValueCents)}\n` +
    (program.salesLed ? `Format: sales-led / high-touch engagement\n` : ``) +
    `\nFocus on the outcome the buyer gets and who it's for. Keep it under 40 words. Plain text only.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 200,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `AI request failed (${res.status}). ${detail.slice(0, 300)}` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const description =
      data.content
        ?.filter((b) => b.type === "text" && b.text)
        .map((b) => b.text!.trim())
        .join(" ")
        .trim() ?? "";

    if (!description) {
      return NextResponse.json(
        { error: "AI returned an empty draft. Try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ description });
  } catch (err) {
    console.error("[generate-description] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
