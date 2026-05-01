// =============================================================
// Inngest webhook endpoint
// =============================================================
// This is the URL Inngest calls to dispatch events to our
// durable functions. Inngest auto-discovers it via the standard
// /api/inngest path. No manual webhook setup required — it's
// registered when the SDK syncs on first deployment.
// =============================================================

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { researchReportFn } from "@/lib/inngest/functions/research-report";
import { generateGammaFn } from "@/lib/inngest/functions/generate-gamma";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [researchReportFn, generateGammaFn],
});
