// Shared server-side "does this platform's API credential actually work right
// now?" verification. Used by BOTH the per-card live check (POST /api/
// automations/check-key) and the scheduled Auto-API health check (the cron).
// Runs entirely server-side; only a boolean per platform ever leaves.
//
// Only platforms with a live integration can pass; anything else (e.g. Zapier,
// which has no API) always returns false.

import { verifyMakeToken } from "@/lib/integrations/make-client";
import { verifyN8nToken } from "@/lib/integrations/n8n-client";
import { verifyGhlAutomations } from "@/lib/integrations/ghl-client";
import { AUTOMATION_SITES } from "./sites";

/** Live-verify one platform's credential. False for platforms with no live
 *  integration (or on any auth failure / error). */
export async function verifyPlatform(platform: string): Promise<boolean> {
  if (platform === "make") return verifyMakeToken();
  if (platform === "n8n") return verifyN8nToken();
  if (platform === "ghl" || platform === "ghl-b2b") {
    return verifyGhlAutomations(platform);
  }
  return false;
}

/** Verify every known automation site at once; returns a { slug: ok } map. */
export async function verifyAllPlatforms(): Promise<Record<string, boolean>> {
  const entries = await Promise.all(
    AUTOMATION_SITES.map(
      async (site) => [site.slug, await verifyPlatform(site.slug)] as const,
    ),
  );
  return Object.fromEntries(entries);
}
