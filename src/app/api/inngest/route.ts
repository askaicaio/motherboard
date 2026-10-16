// =============================================================
// Inngest webhook endpoint
// =============================================================
// This is the URL Inngest calls to dispatch events to our
// durable functions. Inngest auto-discovers it via the standard
// /api/inngest path.
//
// IMPORTANT: Inngest does NOT bypass Vercel's per-function timeout.
// Each step.run() is invoked as a separate webhook call from Inngest,
// and each call is capped by this `maxDuration`.
//
// This used to be 800, because deep research ran as ONE 8-12 minute Anthropic
// call and 800s is Vercel's Pro ceiling. That pinned the whole app to Pro for
// the sake of a single step. Deep research now goes through the Message
// Batches API (submit → poll → fetch) in research-report.ts, so every step
// here finishes in seconds and 300 is plenty.
//
// 300 is also Hobby's default AND maximum, so this route no longer depends on
// the plan. Don't raise it back without checking what actually needs the time —
// on Hobby a higher value buys nothing, and the step would fail at 300 anyway.
// =============================================================

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { researchReportFn } from "@/lib/inngest/functions/research-report";
import { generateGammaFn } from "@/lib/inngest/functions/generate-gamma";

// (Must be a build-time literal — Vercel reads it at deploy time.)
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [researchReportFn, generateGammaFn],
});
