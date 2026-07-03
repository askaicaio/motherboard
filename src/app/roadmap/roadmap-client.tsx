"use client";

import Image from "next/image";
import Script from "next/script";
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

// GHL embed script — makes the booking widget size/behave correctly.
const GHL_EMBED_SCRIPT = "https://link.msgsndr.com/js/form_embed.js";

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
          // ── Editorial / executive palette (no orange anywhere) ──
          "--navy": "#0f172a", // deep slate-navy — primary ink + dark CTA
          "--indigo": "#1e1b4b", // deep indigo for gradient depth
          "--blue": "#2563eb", // restrained blue accent for links/eyebrows
          "--ink": "#0f172a",
          "--muted": "#475569", // slate body text
          "--paper": "#fbfbfd", // near-white off-white background
          "--hair": "#e7e9ef", // hairline divider
        } as React.CSSProperties
      }
    >
      {/* GHL embed script — required for the booking widget to size correctly. */}
      <Script src={GHL_EMBED_SCRIPT} strategy="afterInteractive" />

      <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased [--edge:1.5rem] sm:[--edge:2rem]">
        {/* ─────────────────── HEADER ─────────────────── */}
        <header className="sticky top-0 z-30 border-b border-[var(--hair)]/70 bg-[var(--paper)]/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-[var(--edge)]">
            <a href="#top" className="flex items-center gap-2.5" aria-label="Chief AI Officer">
              <Image
                src="/caio-logo-black.png"
                alt="Chief AI Officer"
                width={32}
                height={32}
                priority
                className="h-7 w-7 sm:h-8 sm:w-8"
              />
              <span className="flex flex-col leading-tight">
                <span className="text-[0.82rem] font-semibold tracking-tight text-[var(--navy)]">
                  Chief AI Officer
                </span>
                <span className="text-[0.58rem] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                  In partnership with Scaling Up
                </span>
              </span>
            </a>
            <button
              type="button"
              onClick={scrollToBooking}
              className="hidden items-center rounded-full bg-[var(--navy)] px-4 py-2 text-[0.82rem] font-semibold text-white transition hover:bg-[var(--indigo)] active:scale-[0.98] sm:inline-flex"
            >
              Book a call
            </button>
          </div>
        </header>

        <span id="top" className="sr-only" />

        {/* ─────────────────── 1. HERO ─────────────────── */}
        <section className="relative flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden px-[var(--edge)] pt-8 pb-10 sm:min-h-0 sm:pt-20 sm:pb-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(115% 70% at 50% -8%, rgba(37,99,235,0.08) 0%, transparent 60%)",
            }}
          />
          <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center">
            {/* Eyebrow */}
            <div className="flex items-center gap-2.5 anim-rise" style={{ animationDelay: "0ms" }}>
              <span className="h-px w-6 bg-[var(--blue)]/50" aria-hidden />
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--blue)]">
                The Four Stages of AI Adoption
              </p>
            </div>

            {/* Headline — Instrument Serif italic + navy→blue gradient */}
            <h1
              className="anim-rise mt-5 text-balance text-[2.55rem] italic leading-[1.03] tracking-[-0.01em] sm:text-[3.75rem]"
              style={{
                animationDelay: "60ms",
                fontFamily: "var(--font-roadmap-serif), Georgia, serif",
                backgroundImage:
                  "linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #2563eb 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {heroHeadline}
            </h1>

            <p
              className="anim-rise mt-6 max-w-xl text-pretty text-[1.06rem] leading-relaxed text-[var(--muted)] sm:text-lg"
              style={{ animationDelay: "120ms" }}
            >
              {heroSubhead}
            </p>

            {/* Primary CTA — DARK button, thumb-reachable, visible without scroll */}
            <div
              className="anim-rise mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
              style={{ animationDelay: "180ms" }}
            >
              <button
                type="button"
                onClick={scrollToBooking}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--navy)] px-8 py-4 text-base font-semibold text-white shadow-[0_10px_30px_-10px_rgba(15,23,42,0.55)] transition hover:bg-[var(--indigo)] active:scale-[0.99] sm:w-auto"
              >
                {heroCta}
                <span
                  aria-hidden
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  →
                </span>
              </button>
              <p className="text-sm text-slate-500 sm:ml-1">{heroTrust}</p>
            </div>
          </div>

          {/* Subtle scroll affordance */}
          <div
            aria-hidden
            className="anim-fade relative mx-auto mt-10 hidden w-full max-w-2xl sm:block"
            style={{ animationDelay: "260ms" }}
          >
            <div className="h-px w-full bg-[var(--hair)]" />
          </div>
        </section>

        {/* ─────────────────── 2. THE FOUR STAGES ─────────────────── */}
        <section className="border-t border-[var(--hair)] px-[var(--edge)] py-16 sm:py-24">
          <div className="mx-auto max-w-2xl">
            <SectionLabel>The ladder</SectionLabel>
            <h2
              className="mt-3 text-balance text-3xl italic leading-tight tracking-[-0.01em] text-[var(--navy)] sm:text-[2.5rem]"
              style={{ fontFamily: "var(--font-roadmap-serif), Georgia, serif" }}
            >
              The four stages of AI adoption
            </h2>
            <p className="mt-3 max-w-lg text-[1.02rem] leading-relaxed text-[var(--muted)]">
              Place yourself on the ladder — most teams are further down than
              they think.
            </p>

            <ol className="mt-10 flex flex-col gap-3.5">
              {STAGES.map((s, i) => (
                <li
                  key={s.n}
                  className="group relative overflow-hidden rounded-2xl border border-[var(--hair)] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_12px_32px_-16px_rgba(15,23,42,0.25)]"
                >
                  {/* left accent that intensifies down the ladder */}
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1"
                    style={{
                      background: "var(--blue)",
                      opacity: 0.2 + i * 0.26,
                    }}
                  />
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--navy)] text-lg font-semibold text-white tabular-nums">
                      {s.n}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold tracking-tight text-[var(--navy)]">
                        {s.name}
                      </h3>
                      <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--muted)]">
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
        <section className="border-t border-[var(--hair)] bg-white px-[var(--edge)] py-16 sm:py-24">
          <div className="mx-auto max-w-2xl">
            <SectionLabel>What you get</SectionLabel>
            <h2
              className="mt-3 text-3xl italic tracking-[-0.01em] text-[var(--navy)] sm:text-[2.5rem]"
              style={{ fontFamily: "var(--font-roadmap-serif), Georgia, serif" }}
            >
              A map, and a guide to read it
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--hair)] bg-[var(--paper)] p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--blue)]/10 text-[var(--blue)]">
                  <MapIcon />
                </span>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--blue)]">
                  The roadmap
                </p>
                <p className="mt-2 text-[0.98rem] leading-relaxed text-slate-700">
                  The Four Stages of AI Adoption, laid out end to end — a clear
                  map of where AI value comes from and what separates each stage
                  from the next.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--hair)] bg-[var(--paper)] p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--blue)]/10 text-[var(--blue)]">
                  <CompassIcon />
                </span>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--blue)]">
                  The call
                </p>
                <p className="mt-2 text-[0.98rem] leading-relaxed text-slate-700">
                  Our team maps the four stages to <em>your</em> business,
                  pinpoints exactly where you are today, and shows the fastest
                  path to the next stage.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────── 4. HOW IT WORKS ─────────────────── */}
        <section className="border-t border-[var(--hair)] px-[var(--edge)] py-16 sm:py-24">
          <div className="mx-auto max-w-2xl">
            <SectionLabel>How it works</SectionLabel>
            <h2
              className="mt-3 text-3xl italic tracking-[-0.01em] text-[var(--navy)] sm:text-[2.5rem]"
              style={{ fontFamily: "var(--font-roadmap-serif), Georgia, serif" }}
            >
              Three steps, about twenty minutes
            </h2>
            <ol className="mt-8 flex flex-col gap-3">
              {[
                {
                  t: "Book a short call",
                  d: "Pick a time from the calendar below.",
                },
                {
                  t: "Get your Four Stages roadmap",
                  d: "Yours to keep, in your inbox.",
                },
                {
                  t: "We map it to your business, live",
                  d: "Leave knowing your exact next stage.",
                },
              ].map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-4 rounded-2xl border border-[var(--hair)] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--blue)]/10 text-sm font-semibold text-[var(--blue)] tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[1.02rem] font-semibold tracking-tight text-[var(--navy)]">
                      {step.t}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--muted)]">{step.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ─────────────────── 5. BOOKING (conversion point) ─────────────────── */}
        <section
          ref={bookingRef}
          id="booking"
          className="scroll-mt-16 border-t border-[var(--hair)] bg-[var(--navy)] px-[var(--edge)] py-16 sm:py-24"
          style={{
            backgroundImage:
              "radial-gradient(120% 80% at 50% -10%, rgba(37,99,235,0.22) 0%, transparent 55%)",
          }}
        >
          <div className="mx-auto max-w-2xl">
            <div className="text-center">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-blue-300/90">
                Reserve your call
              </p>
              <h2
                className="mt-3 text-3xl italic tracking-[-0.01em] text-white sm:text-[2.5rem]"
                style={{
                  fontFamily: "var(--font-roadmap-serif), Georgia, serif",
                }}
              >
                Book your roadmap call
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[1.02rem] leading-relaxed text-slate-300">
                Pick a time that works. It&apos;s short, and you&apos;ll leave
                knowing your next stage.
              </p>
            </div>

            <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow-[0_30px_60px_-25px_rgba(0,0,0,0.6)]">
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

        {/* ─────────────────── 7. CREDIBILITY (Chris Daigle) ─────────────────── */}
        <section className="border-t border-[var(--hair)] px-[var(--edge)] py-16 sm:py-20">
          <div className="mx-auto max-w-2xl">
            <figure className="rounded-3xl border border-[var(--hair)] bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-10">
              <blockquote className="text-pretty text-[1.15rem] leading-relaxed text-[var(--navy)] sm:text-[1.3rem]">
                &ldquo;Most companies aren&apos;t behind on AI. They&apos;re just
                stuck between stages — and can&apos;t see the next one.&rdquo;
              </blockquote>
              <figcaption className="mt-6 flex flex-col items-center gap-1">
                <span className="text-sm font-semibold tracking-tight text-[var(--navy)]">
                  Chris Daigle
                </span>
                <span className="text-sm text-[var(--muted)]">
                  CEO, Chief AI Officer · keynote speaker on enterprise AI
                  adoption
                </span>
              </figcaption>
            </figure>
            <p className="mt-6 text-center text-sm text-slate-500">
              Trusted by leaders turning AI experiments into measurable business
              results.
            </p>
          </div>
        </section>

        {/* ─────────────────── 8. FOOTER ─────────────────── */}
        <footer className="border-t border-[var(--hair)] bg-white px-[var(--edge)] py-12">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-2.5">
              <Image
                src="/caio-logo-black.png"
                alt="Chief AI Officer"
                width={28}
                height={28}
                className="h-7 w-7"
              />
              <span className="flex flex-col leading-tight text-left">
                <span className="text-sm font-semibold tracking-tight text-[var(--navy)]">
                  Chief AI Officer
                </span>
                <span className="text-[0.6rem] font-medium uppercase tracking-[0.14em] text-slate-400">
                  In partnership with Scaling Up
                </span>
              </span>
            </div>
            <p className="text-sm text-slate-500">roadmap.chiefaiofficer.com</p>
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} Chief AI Officer. All rights reserved.
            </p>
          </div>
        </footer>
      </main>

      {/* Scoped entrance motion — respects prefers-reduced-motion. */}
      <style jsx global>{`
        @keyframes roadmapRise {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes roadmapFade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .anim-rise {
          animation: roadmapRise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .anim-fade {
          animation: roadmapFade 0.8s ease both;
        }
        @media (prefers-reduced-motion: reduce) {
          .anim-rise,
          .anim-fade {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// ── Small presentational helpers ─────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-px w-6 bg-[var(--blue)]/50" aria-hidden />
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--blue)]">
        {children}
      </p>
    </div>
  );
}

function MapIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 4 6 2 5-2v14l-5 2-6-2-5 2V6z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </svg>
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
      setErrorMsg(data?.error || "Something went wrong. Please try again.");
      setStatus("error");
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  return (
    <section className="border-t border-[var(--hair)] bg-white px-[var(--edge)] py-16 sm:py-20">
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl border border-[var(--hair)] bg-[var(--paper)] p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-8">
          <SectionLabel>Or by email</SectionLabel>
          <h2
            className="mt-3 text-2xl italic tracking-[-0.01em] text-[var(--navy)] sm:text-[1.9rem]"
            style={{ fontFamily: "var(--font-roadmap-serif), Georgia, serif" }}
          >
            Prefer the roadmap in your inbox?
          </h2>

          {status === "done" ? (
            <div
              className="anim-rise mt-5 rounded-2xl border border-[var(--hair)] bg-white p-5"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--blue)]/10 text-[var(--blue)]">
                  <CheckIcon />
                </span>
                <div>
                  <p className="text-[1.02rem] leading-relaxed text-slate-700">
                    You&apos;re all set — check your inbox. The Four Stages
                    roadmap is attached to an email we just sent to{" "}
                    <span className="font-semibold text-[var(--navy)]">
                      {email}
                    </span>
                    .
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Don&apos;t see it in a minute or two? Check your spam or
                    promotions folder.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-[var(--muted)]">
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
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-[0.95rem] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20"
                  />
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name (optional)"
                    autoComplete="family-name"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-[0.95rem] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20"
                  />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-[0.95rem] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20"
                />

                {status === "error" && errorMsg && (
                  <p className="text-sm text-red-600" role="alert">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--navy)] px-6 py-3.5 text-base font-semibold text-white shadow-[0_10px_30px_-12px_rgba(15,23,42,0.55)] transition hover:bg-[var(--indigo)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status === "submitting" ? "Sending…" : "Send me the roadmap"}
                </button>
                <p className="text-center text-xs text-slate-400">
                  No spam. Unsubscribe anytime.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
