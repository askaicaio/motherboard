import { describe, it, expect } from "vitest";
import {
  parseRate,
  resolveRate,
  computeCommission,
  addDays,
  computeWindows,
  refundWindowPassed,
  clickWithinWindow,
  disputeWithinWindow,
  isDirectIntroValid,
  pickFirstAttribution,
  generateRefCode,
} from "../rules";

describe("parseRate", () => {
  it("parses a normal rate", () => {
    expect(parseRate("0.10")).toBeCloseTo(0.1);
    expect(parseRate("0")).toBe(0);
    expect(parseRate("1")).toBe(1);
  });
  it("rejects out-of-range / garbage", () => {
    expect(() => parseRate("1.5")).toThrow();
    expect(() => parseRate("-0.1")).toThrow();
    expect(() => parseRate("abc")).toThrow();
  });
});

describe("resolveRate", () => {
  const settings = { defaultCommissionRate: "0.10" };
  it("uses the default when no override", () => {
    expect(resolveRate({ commissionRateOverride: null }, settings)).toBeCloseTo(0.1);
    expect(resolveRate({ commissionRateOverride: "" }, settings)).toBeCloseTo(0.1);
  });
  it("program override wins", () => {
    expect(resolveRate({ commissionRateOverride: "0.15" }, settings)).toBeCloseTo(0.15);
  });
});

describe("computeCommission — Terms §3.3 basis", () => {
  it("10% of gross when no fees", () => {
    // ROI Blueprint $10,000 → $1,000
    const r = computeCommission({
      grossCents: 1_000_000,
      feesCents: 0,
      nonCommissionableCents: 0,
      rate: 0.1,
    });
    expect(r.commissionableCents).toBe(1_000_000);
    expect(r.commissionCents).toBe(100_000);
  });

  it("subtracts fees and non-commissionable BEFORE applying the rate (not list price)", () => {
    // $12,000 gross, $500 tax fee, $1,000 setup (non-commissionable)
    const r = computeCommission({
      grossCents: 1_200_000,
      feesCents: 50_000,
      nonCommissionableCents: 100_000,
      rate: 0.1,
    });
    expect(r.commissionableCents).toBe(1_050_000);
    expect(r.commissionCents).toBe(105_000);
  });

  it("never goes negative when fees exceed gross", () => {
    const r = computeCommission({
      grossCents: 100,
      feesCents: 500,
      nonCommissionableCents: 0,
      rate: 0.1,
    });
    expect(r.commissionableCents).toBe(0);
    expect(r.commissionCents).toBe(0);
  });

  it("rounds to the nearest cent", () => {
    // 333 cents * 0.10 = 33.3 → 33
    const r = computeCommission({
      grossCents: 333,
      feesCents: 0,
      nonCommissionableCents: 0,
      rate: 0.1,
    });
    expect(r.commissionCents).toBe(33);
  });
});

describe("window math", () => {
  const purchase = new Date("2026-06-01T12:00:00.000Z");
  it("addDays is pure instant arithmetic", () => {
    expect(addDays(purchase, 7).toISOString()).toBe("2026-06-08T12:00:00.000Z");
  });
  it("computeWindows: refund per settings, dispute fixed 14d", () => {
    const w = computeWindows(purchase, 7);
    expect(w.refundWindowEndsAt.toISOString()).toBe("2026-06-08T12:00:00.000Z");
    expect(w.disputeWindowEndsAt.toISOString()).toBe("2026-06-15T12:00:00.000Z");
  });
  it("refundWindowPassed", () => {
    const ends = addDays(purchase, 7);
    expect(refundWindowPassed(ends, addDays(purchase, 6))).toBe(false);
    expect(refundWindowPassed(ends, addDays(purchase, 7))).toBe(true);
    expect(refundWindowPassed(ends, addDays(purchase, 8))).toBe(true);
  });
});

describe("clickWithinWindow (cookie age measured from click time)", () => {
  const click = new Date("2026-01-01T00:00:00.000Z");
  it("inside the 60-day window", () => {
    expect(clickWithinWindow(click, 60, addDays(click, 59))).toBe(true);
    expect(clickWithinWindow(click, 60, addDays(click, 60))).toBe(true);
  });
  it("just past the window", () => {
    expect(clickWithinWindow(click, 60, addDays(click, 61))).toBe(false);
  });
});

describe("disputeWithinWindow — 14 days from close (Terms §5.4)", () => {
  const close = new Date("2026-06-01T00:00:00.000Z");
  it("within 14 days", () => {
    expect(disputeWithinWindow(close, addDays(close, 14))).toBe(true);
  });
  it("after 14 days", () => {
    expect(disputeWithinWindow(close, addDays(close, 15))).toBe(false);
  });
});

describe("isDirectIntroValid — logged before proposal (Playbook §13)", () => {
  const recorded = new Date("2026-03-01T00:00:00.000Z");
  it("valid when recorded before the proposal", () => {
    expect(isDirectIntroValid(recorded, addDays(recorded, 1))).toBe(true);
    expect(isDirectIntroValid(recorded, recorded)).toBe(true); // same instant ok
  });
  it("invalid when recorded after the proposal", () => {
    expect(isDirectIntroValid(recorded, addDays(recorded, -1))).toBe(false);
  });
  it("valid when proposal date unknown", () => {
    expect(isDirectIntroValid(recorded, null)).toBe(true);
    expect(isDirectIntroValid(recorded, undefined)).toBe(true);
  });
});

describe("pickFirstAttribution — first-attribution-wins (Terms §5.3)", () => {
  const base = new Date("2026-01-01T00:00:00.000Z");
  it("earliest recorded_at wins among valid candidates", () => {
    const winner = pickFirstAttribution([
      { id: "b", type: "tracked_link", recordedAt: addDays(base, 14), isValid: true },
      { id: "a", type: "direct_intro", recordedAt: addDays(base, 0), isValid: true },
    ]);
    expect(winner?.id).toBe("a");
  });
  it("invalid candidates are ignored even if earlier", () => {
    const winner = pickFirstAttribution([
      { id: "invalid-early", type: "direct_intro", recordedAt: base, isValid: false },
      { id: "valid-late", type: "tracked_link", recordedAt: addDays(base, 5), isValid: true },
    ]);
    expect(winner?.id).toBe("valid-late");
  });
  it("a documented direct_intro beats a later tracked_link", () => {
    const winner = pickFirstAttribution([
      { id: "intro", type: "direct_intro", recordedAt: base, isValid: true },
      { id: "click", type: "tracked_link", recordedAt: addDays(base, 30), isValid: true },
    ]);
    expect(winner?.id).toBe("intro");
  });
  it("returns null with no eligible candidates", () => {
    expect(pickFirstAttribution([])).toBeNull();
    expect(
      pickFirstAttribution([
        { id: "x", type: "tracked_link", recordedAt: base, isValid: false },
      ]),
    ).toBeNull();
  });
});

describe("generateRefCode", () => {
  it("produces an 8-char base62 code by default", () => {
    const code = generateRefCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-Za-z0-9]+$/);
  });
  it("is highly unlikely to collide across many draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateRefCode());
    expect(seen.size).toBe(5000);
  });
});
