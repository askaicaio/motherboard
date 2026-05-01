// =============================================================
// Inngest webhook endpoint
// =============================================================
// This is the URL Inngest calls to dispatch events to our
// durable functions. Inngest auto-discovers it via the standard
// /api/inngest path.
//
// IMPORTANT: Inngest does NOT bypass Vercel's per-function timeout.
// Each step.run() is invoked as a separate webhook call from Inngest,
// and each call is capped by this `maxDuration`. With Vercel Fluid
// Compute on Pro plan, the max is 800s (~13 min) which is enough for
// our deep research calls.
//
// Requirements (already configured if you're on Vercel Pro):
//   - Vercel Pro plan
//   - Fluid Compute enabled (Settings → Functions → Fluid Compute)
// =============================================================

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { researchReportFn } from "@/lib/inngest/functions/research-report";
import { generateGammaFn } from "@/lib/inngest/functions/generate-gamma";

// 800 seconds = 13.3 minutes — Vercel Pro + Fluid Compute maximum
export const maxDuration = 800;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [researchReportFn, generateGammaFn],
});
