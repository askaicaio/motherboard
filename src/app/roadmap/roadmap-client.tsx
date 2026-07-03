"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
interface RoadmapClientProps {
  fontClassName: string;
  bookingBaseUrl: string;
  heroHeadline: string;
  heroSubhead: string;
  heroCta: string;
  heroTrust: string;
}

type Utm = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const UTM_STORAGE_KEY = "roadmap_utm";

// ── Content (verbatim) ──────────────────────────────────────────────────────
const STAGES = [
  {
    n: 1,
    name: "Experimentation",
    desc: "Individuals are trying AI on their own. A few see value; most don't. No shared strategy, and the wins don't compound.",
    here: "a handful of people use ChatGPT, there's no shared plan, and nothing carries beyond the individual.",
  },
  {
    n: 2,
    name: "Application",
    desc: "Teams have found real use cases and early wins, but they're trapped in silos. Results ride on a few enthusiasts, and the knowledge doesn't transfer.",
    here: "you've had real wins, but they live in pockets and depend on one or two champions.",
  },
  {
    n: 3,
    name: "Integration",
    desc: "AI is wired into how work actually happens. Custom assistants and agents run real workflows, and you can measure the hours and dollars they save.",
    here: "AI runs inside real workflows and you can point to specific hours and dollars saved.",
  },
  {
    n: 4,
    name: "Transformation",
    desc: "AI is part of your operating model and your competitive advantage. It shapes strategy, not just tasks — and you improve faster than competitors can copy.",
    here: "AI shapes strategy and decisions, and you're pulling ahead of competitors who can't keep up.",
  },
] as const;

export default function RoadmapClient({
  fontClassName,
  bookingBaseUrl,
  heroHeadline,
  heroSubhead,
  heroCta,
  heroTrust,
}: RoadmapClientProps) {
  const [utm, setUtm] = useState<Utm>({});
  const bookingRef = useRef<HTMLDivElement>(null);

  // ── Attribution: read UTM on load, persist to state + sessionStorage ──────
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl: Utm = {};
      for (const key of UTM_KEYS) {
        const v = params.get(key);
        if (v) fromUrl[key] = v;
      }

      if (Object.keys(fromUrl).length > 0) {
        setUtm(fromUrl);
        sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(fromUrl));
        return;
      }

      const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Utm;
        setUtm(parsed);
      }
    } catch {
      // sessionStorage / URL parsing unavailable — attribution is best-effort.
    }
  }, []);

  // ── Booking iframe src with native GHL attribution query string ───────────
  const bookingSrc = useMemo(() => {
    const qs = new URLSearchParams();
    for (const key of UTM_KEYS) {
      const v = utm[key];
      if (v) qs.set(key, v);
    }
    const query = qs.toString();
    if (!query) return bookingBaseUrl;
    const sep = bookingBaseUrl.includes("?") ? "&" : "?";
    return `${bookingBaseUrl}${sep}${query}`;
  }, [bookingBaseUrl, utm]);

  const scrollToBooking = useCallback(() => {
    bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div
      className={fontClassName}
      style={
        {
          // Scope fonts to this page root so they don't leak into the app.
          fontFamily:
            "var(--font-roadmap-sans), ui-sans-serif, system-ui, sans-serif",
          // Palette tokens (deep navy/blue + one warm accent).
          "--navy": "#0b1437",
          "--blue": "#2f4fd8",
          "--accent": "#e8823a",
          "--accent-hover": "#d97324",
          "--ink": "#0b1437",
          "--paper": "#faf8f4",
        } as React.CSSProperties
      }
    >
      <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased">
        {/* ─────────────────── 1. HERO ─────────────────── */}
        <section className="relative flex min-h-[100svh] flex-col overflow-hidden px-6 pt-10 pb-8 sm:min-h-0 sm:px-8 sm:pt-16 sm:pb-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 80% at 50% -10%, rgba(47,79,216,0.10) 0%, transparent 55%)",
            }}
          />
          <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center">
            {/* Eyebrow wordmark */}
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--blue)]">
              Chief AI Officer
            </p>

            {/* Headline — Instrument Serif italic + navy→blue gradient */}
            <h1
              className="mt-5 text-balance text-[2.6rem] italic leading-[1.02] tracking-tight sm:text-6xl"
              style={{
                fontFamily: "var(--font-roadmap-serif), Georgia, serif",
                backgroundImage: "linear-gradient(135deg, #0b1437 0%, #2f4fd8 95%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {heroHeadline}
            </h1>

            <p className="mt-6 max-w-xl text-pretty text-[1.05rem] leading-relaxed text-slate-600 sm:text-lg">
              {heroSubhead}
            </p>

            {/* Primary CTA — thumb-reachable, visible without scroll at 375px */}
            <div className="mt-8">
              <button
                type="button"
                onClick={scrollToBooking}
                className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[var(--accent)]/25 transition hover:bg-[var(--accent-hover)] active:scale-[0.99] sm:w-auto"
              >
                {heroCta}
              </button>
            </div>

            <p className="mt-5 text-sm text-slate-500">{heroTrust}</p>
          </div>
        </section>

        {/* ─────────────────── 2. THE FOUR STAGES ─────────────────── */}
        <section className="px-6 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-2xl">
            <h2
              className="text-balance text-3xl italic leading-tight tracking-tight text-[var(--navy)] sm:text-4xl"
              style={{ fontFamily: "var(--font-roadmap-serif), Georgia, serif" }}
            >
              The four stages of AI adoption
            </h2>
            <p className="mt-3 text-slate-600">
              Place yourself on the ladder — most teams are further down than
              they think.
            </p>

            <ol className="mt-10 flex flex-col gap-4">
              {STAGES.map((s) => (
                <li
                  key={s.n}
                  className="relative rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--navy)] text-lg font-semibold text-white tabular-nums">
                      {s.n}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-[var(--navy)]">
                        {s.name}
                      </h3>
                      <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-600">
                        {s.desc}
                      </p>
                      <p className="mt-3 text-[0.95rem] leading-relaxed text-slate-700">
                        <strong className="font-semibold text-[var(--navy)]">
                          You&apos;re here if:
                        </strong>{" "}
                        {s.here}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ─────────────────── 3. WHAT YOU GET ─────────────────── */}
        <section className="bg-white px-6 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-2xl">
            <h2
              className="text-3xl italic tracking-tight text-[var(--navy)] sm:text-4xl"
              style={{ fontFamily: "var(--font-roadmap-serif), Georgia, serif" }}
            >
              What you get
            </h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-[var(--paper)] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--blue)]">
                  The roadmap
                </p>
                <p className="mt-3 text-[0.98rem] leading-relaxed text-slate-700">
                  The Four Stages of AI Adoption, laid out end to end — a clear
                  map of where AI value comes from and what separates each stage
                  from the next.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-[var(--paper)] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--blue)]">
                  The call
                </p>
                <p className="mt-3 text-[0.98rem] leading-relaxed text-slate-700">
                  Our team maps the four stages to <em>your</em> business,
                  pinpoints exactly where you are today, and shows the fastest
                  path to the next stage.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────── 4. HOW IT WORKS ─────────────────── */}
        <section className="px-6 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-2xl">
            <h2
              className="text-3xl italic tracking-tight text-[var(--navy)] sm:text-4xl"
              style={{ fontFamily: "var(--font-roadmap-serif), Georgia, serif" }}
            >
              How it works
            </h2>
            <ol className="mt-8 flex flex-col gap-4">
              {[
                "Book a short call",
                "Get your Four Stages roadmap",
                "We map it to your business, live",
              ].map((step, i) => (
                <li
                  key={i}
                  className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--blue)]/10 text-sm font-semibold text-[var(--blue)] tabular-nums">
                    {i + 1}
                  </span>
                  <span className="text-[1.02rem] font-medium text-[var(--navy)]">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ─────────────────── 5. BOOKING (conversion point) ─────────────────── */}
        <section
          ref={bookingRef}
          id="booking"
          className="scroll-mt-4 bg-[var(--navy)] px-4 py-16 sm:px-8 sm:py-24"
        >
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <h2
                className="text-3xl italic tracking-tight text-white sm:text-4xl"
                style={{
                  fontFamily: "var(--font-roadmap-serif), Georgia, serif",
                }}
              >
                Book your roadmap call
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-slate-300">
                Pick a time that works. It&apos;s short, and you&apos;ll leave
                knowing your next stage.
              </p>
            </div>

            <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow-xl">
              {/* min-height reserves space to avoid CLS while the iframe loads */}
              <iframe
                key={bookingSrc}
                src={bookingSrc}
                title="Book your roadmap call"
                loading="lazy"
                className="w-full"
                style={{ minHeight: 700, border: "0", display: "block" }}
                scrolling="no"
              />
            </div>
          </div>
        </section>

        {/* ─────────────────── 6. SECONDARY CAPTURE (email) ─────────────────── */}
        <EmailCapture utm={utm} />

        {/* ─────────────────── 7. CREDIBILITY (light) ─────────────────── */}
        <section className="px-6 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[1.05rem] leading-relaxed text-slate-700">
              Led by{" "}
              <strong className="font-semibold text-[var(--navy)]">
                Chris Daigle
              </strong>
              , CEO and keynote speaker on enterprise AI adoption.
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Trusted by leaders turning AI experiments into measurable business
              results.
            </p>
            {/* Optional placeholder logo row */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 opacity-50">
              {["ACME", "NORTHWIND", "GLOBEX", "INITECH"].map((logo) => (
                <span
                  key={logo}
                  className="text-sm font-semibold tracking-[0.15em] text-slate-400"
                >
                  {logo}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────── 8. FOOTER ─────────────────── */}
        <footer className="border-t border-slate-200/80 bg-white px-6 py-10 sm:px-8">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--blue)]">
              Chief AI Officer
            </p>
            <p className="text-sm text-slate-500">roadmap.chiefaiofficer.com</p>
            <p className="text-xs text-slate-400">© 2026 Chief AI Officer</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

// ── Secondary capture form ──────────────────────────────────────────────────
function EmailCapture({ utm }: { utm: Utm }) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          ...utm,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setStatus("done");
        return;
      }
      setErrorMsg(
        data?.error || "Something went wrong. Please try again.",
      );
      setStatus("error");
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  return (
    <section className="bg-white px-6 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-slate-200/80 bg-[var(--paper)] p-6 shadow-sm sm:p-8">
          <h2
            className="text-2xl italic tracking-tight text-[var(--navy)] sm:text-3xl"
            style={{ fontFamily: "var(--font-roadmap-serif), Georgia, serif" }}
          >
            Prefer the roadmap by email?
          </h2>

          {status === "done" ? (
            <div className="mt-5">
              <p className="text-[1.02rem] leading-relaxed text-slate-700">
                You&apos;re all set — check your inbox. The Four Stages roadmap is
                attached to an email we just sent to{" "}
                <span className="font-semibold text-[var(--navy)]">{email}</span>.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Don&apos;t see it in a minute or two? Check your spam or promotions
                folder.
              </p>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-600">
                We&apos;ll send the Four Stages roadmap straight to your inbox.
              </p>
              <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name (optional)"
                    autoComplete="given-name"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[0.95rem] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20"
                  />
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name (optional)"
                    autoComplete="family-name"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[0.95rem] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20"
                  />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[0.95rem] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20"
                />

                {status === "error" && errorMsg && (
                  <p className="text-sm text-red-600">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--navy)] px-6 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-[#12204f] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status === "submitting" ? "Sending…" : "Send me the roadmap"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
