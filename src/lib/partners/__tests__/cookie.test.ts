import { describe, it, expect, beforeAll } from "vitest";
import {
  encodeAffCookie,
  decodeAffCookie,
  type AffCookiePayload,
} from "../cookie";

beforeAll(() => {
  // Cookie signing needs a secret; set a deterministic one for the test.
  process.env.NEXTAUTH_SECRET = "test-secret-for-affiliate-cookie";
});

const payload: AffCookiePayload = {
  cookieId: "11111111-2222-3333-4444-555555555555",
  refCode: "AbC12345",
  ts: 1_750_000_000_000,
};

describe("affiliate cookie", () => {
  it("round-trips a payload", () => {
    const encoded = encodeAffCookie(payload);
    const decoded = decodeAffCookie(encoded);
    expect(decoded).toEqual(payload);
  });

  it("rejects a tampered payload (changed ref_code)", () => {
    const encoded = encodeAffCookie(payload);
    const [body, sig] = encoded.split(".");
    // Forge a different payload but keep the old signature.
    const forgedBody = Buffer.from(
      JSON.stringify({ ...payload, refCode: "EVILCODE" }),
    ).toString("base64url");
    expect(decodeAffCookie(`${forgedBody}.${sig}`)).toBeNull();
    // The original still verifies.
    expect(decodeAffCookie(`${body}.${sig}`)).toEqual(payload);
  });

  it("rejects malformed values", () => {
    expect(decodeAffCookie(undefined)).toBeNull();
    expect(decodeAffCookie("")).toBeNull();
    expect(decodeAffCookie("nodot")).toBeNull();
    expect(decodeAffCookie("a.b.c")).toBeNull();
  });
});
