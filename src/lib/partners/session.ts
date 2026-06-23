// =============================================================
// Partner portal session — ISOLATED from staff NextAuth
// =============================================================
// Partners are external users. They must NEVER share the staff session
// cookie (authjs.session-token) — the staff proxy trusts that cookie's
// mere existence, so a partner holding one could reach staff routes.
// So the portal uses its own HMAC-signed cookie (caio_partner) carrying
// only { partnerId, ts }, verified independently here.
// =============================================================

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { partners } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const PARTNER_COOKIE = "caio_partner";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

interface PartnerToken {
  partnerId: string;
  ts: number;
}

function secret(): string {
  const s =
    process.env.PARTNER_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.CRON_SECRET;
  if (!s) throw new Error("No secret available to sign the partner session.");
  return s;
}

function sign(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export function encodePartnerToken(partnerId: string): string {
  const payload: PartnerToken = { partnerId, ts: Date.now() };
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${b64}.${sign(b64)}`;
}

function decodePartnerToken(value: string | undefined): PartnerToken | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const b64 = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(b64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(b64, "base64url").toString("utf8"),
    ) as PartnerToken;
    if (typeof parsed?.partnerId !== "string" || typeof parsed?.ts !== "number") {
      return null;
    }
    // Hard expiry check on the signed timestamp.
    if (Date.now() - parsed.ts > MAX_AGE_SECONDS * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Set the partner session cookie (call after a verified login). */
export async function setPartnerSession(partnerId: string): Promise<void> {
  const jar = await cookies();
  jar.set(PARTNER_COOKIE, encodePartnerToken(partnerId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearPartnerSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(PARTNER_COOKIE);
}

export type PartnerRow = typeof partners.$inferSelect;

/** Returns the logged-in partner, or null. Verifies the partner is active. */
export async function getPartnerSession(): Promise<PartnerRow | null> {
  const jar = await cookies();
  const token = decodePartnerToken(jar.get(PARTNER_COOKIE)?.value);
  if (!token) return null;
  const [partner] = await db
    .select()
    .from(partners)
    .where(eq(partners.id, token.partnerId))
    .limit(1);
  if (!partner) return null;
  // Suspended/terminated/declined partners can't use the portal.
  if (!["approved", "active"].includes(partner.status)) return null;
  return partner;
}

/** Portal page guard — redirects to the partner login when not signed in. */
export async function requirePartner(): Promise<PartnerRow> {
  const partner = await getPartnerSession();
  if (!partner) redirect("/portal/login");
  return partner;
}
