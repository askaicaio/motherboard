// =============================================================
// First-party affiliate cookie — HMAC-signed
// =============================================================
// The /r click route sets a `caio_aff` cookie carrying the attribution
// payload. It's HMAC-signed so a malicious client can't forge a ref_code
// into someone else's session. We control both set + read, so this is a
// closed loop — the signature just prevents tampering, not secrecy.
//
// Wire format:  base64url(json).base64url(hmacSHA256(json))
// =============================================================

import { createHmac, timingSafeEqual } from "crypto";

export const AFF_COOKIE_NAME = "caio_aff";

export interface AffCookiePayload {
  /** Random UUID tying this cookie to a partner_clicks row. */
  cookieId: string;
  /** The partner's ref_code. */
  refCode: string;
  /** Issued-at unix ms. */
  ts: number;
}

function secret(): string {
  // Reuse the app's existing secret material. NEXTAUTH_SECRET is always
  // set in any environment that has working auth, so the cookie can always
  // be signed/verified consistently across instances.
  const s =
    process.env.PARTNER_COOKIE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.CRON_SECRET;
  if (!s) {
    throw new Error(
      "No secret available to sign the affiliate cookie — set NEXTAUTH_SECRET.",
    );
  }
  return s;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(jsonB64: string): string {
  return createHmac("sha256", secret()).update(jsonB64).digest("base64url");
}

/** Serialize + sign a payload into the cookie value. */
export function encodeAffCookie(payload: AffCookiePayload): string {
  const jsonB64 = b64url(JSON.stringify(payload));
  return `${jsonB64}.${sign(jsonB64)}`;
}

/** Verify + parse a cookie value. Returns null on any tampering/format error. */
export function decodeAffCookie(value: string | undefined | null): AffCookiePayload | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const jsonB64 = value.slice(0, dot);
  const sig = value.slice(dot + 1);

  const expected = sign(jsonB64);
  // Constant-time compare; lengths must match first or timingSafeEqual throws.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(jsonB64, "base64url").toString("utf8"),
    ) as AffCookiePayload;
    if (
      typeof parsed?.cookieId === "string" &&
      typeof parsed?.refCode === "string" &&
      typeof parsed?.ts === "number"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
