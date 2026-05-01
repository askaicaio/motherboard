// =============================================================
// Inngest client — used by all background functions
// =============================================================
// Inngest gives us durable, retry-able, long-running background
// jobs without Vercel function timeout limits. Each step.run()
// call is durable — if it fails, only that step retries.
//
// Setup:
//   - Sign up at inngest.com
//   - Set INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY in Vercel env
//   - The /api/inngest endpoint is the webhook Inngest calls
// =============================================================

import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "caio-motherboard",
  // Event key + signing key are read automatically from
  // INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY env vars.
});

// ---- Event types ----
// Strongly-typed events keep us honest when sending them.

export type Events = {
  "report/research.requested": {
    data: {
      reportId: string;
      actorId: string;
      actorEmail: string;
    };
  };
  "report/gamma.requested": {
    data: {
      reportId: string;
      actorId: string;
      actorEmail: string;
    };
  };
};
