// =============================================================
// GET /r?aff=REF_CODE&dest=<encoded_url>
// =============================================================
// Public, unauthenticated affiliate click tracker. On hit:
//   1. Resolve ref_code → partner (active partners only track)
//   2. Insert a partner_clicks row
//   3. Set the HMAC-signed caio_aff first-party cookie (cookie window
//      from the active settings row)
//   4. 302 redirect to `dest` with ?aff_id=REF_CODE appended so the
//      affiliate id rides through to checkout even if cookies are blocked
//
// Open-redirect guard: dest must be https and on an allowlisted host.
// Anything else falls back to the default destination.
// =============================================================

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { partnerClicks } from "@/lib/db/schema";
import { getPartnerByRefCode, getActiveSettings } from "@/lib/partners/queries";
import { AFF_COOKIE_NAME, encodeAffCookie } from "@/lib/partners/cookie";

export const dynamic = "force-dynamic";

// Where an affiliate's bare /r?aff=CODE link sends a PROSPECT by default: the
// book-a-call page (set AFFILIATE_BOOKING_URL to your GHL booking/funnel URL).
// The aff code is appended as ?aff_id=… so GHL can capture it into the contact.
const DEFAULT_DEST =
  process.env.AFFILIATE_BOOKING_URL?.replace(/\/$/, "") ||
  process.env.PARTNER_PROGRAM_BASE_URL?.replace(/\/$/, "") ||
  "https://chiefaiofficer.com";
const ALLOWED_HOST_SUFFIXES = ["chiefaiofficer.com"];

/** Allow only https URLs on an allowlisted host (plus localhost in dev). */
function safeDest(raw: string | null): string {
  if (!raw) return DEFAULT_DEST;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return DEFAULT_DEST;
  }
  const host = u.hostname.toLowerCase();
  const isLocal =
    process.env.NODE_ENV !== "production" &&
    (host === "localhost" || host === "127.0.0.1");
  const onAllowlist = ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
  if (u.protocol !== "https:" && !isLocal) return DEFAULT_DEST;
  if (!onAllowlist && !isLocal) return DEFAULT_DEST;
  return u.toString();
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const refCode = (params.get("aff") || "").trim();
  const dest = safeDest(params.get("dest"));

  // Build the final redirect URL up-front so even an unknown ref code
  // still forwards the user somewhere sensible.
  const destUrl = new URL(dest);
  if (refCode) destUrl.searchParams.set("aff_id", refCode);

  const redirect = NextResponse.redirect(destUrl.toString(), {
    status: 302,
    headers: { "X-Robots-Tag": "noindex, nofollow" },
  });

  if (!refCode) return redirect;

  // Resolve partner. Only active/approved partners get tracked — but we
  // never block the redirect on a lookup failure.
  let partner;
  try {
    partner = await getPartnerByRefCode(refCode);
  } catch (err) {
    console.error("[/r] partner lookup failed:", err);
    return redirect;
  }
  if (!partner || !["approved", "active"].includes(partner.status)) {
    return redirect;
  }

  const cookieId = randomUUID();

  // Best-effort click log — telemetry must never break the redirect.
  try {
    await db.insert(partnerClicks).values({
      partnerId: partner.id,
      refCode,
      cookieId,
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        request.headers.get("x-real-ip") ||
        null,
      userAgent: request.headers.get("user-agent") || null,
      referrer: request.headers.get("referer") || null,
      landingPath: dest,
    });
  } catch (err) {
    console.error("[/r] click insert failed:", err);
  }

  // Cookie window from the active settings row.
  let cookieWindowDays = 60;
  try {
    const settings = await getActiveSettings(new Date());
    if (settings) cookieWindowDays = settings.cookieWindowDays;
  } catch {
    // keep default
  }

  redirect.cookies.set(AFF_COOKIE_NAME, encodeAffCookie({
    cookieId,
    refCode,
    ts: Date.now(),
  }), {
    maxAge: cookieWindowDays * 24 * 60 * 60,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return redirect;
}
