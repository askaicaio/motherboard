"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, CalendarClock, Sparkles, Loader2, AlertCircle } from "lucide-react";

interface Program {
  id: string;
  name: string;
  slug: string;
  listValueCents: number;
  isSample: boolean;
}

interface EnrollClientProps {
  programs: Program[];
  initialRef: string;
  bookingUrl: string;
}

function usd(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function EnrollClient({
  programs,
  initialRef,
  bookingUrl,
}: EnrollClientProps) {
  const [ref, setRef] = useState(initialRef);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmedRef = ref.trim();

  const bookingHref = (() => {
    if (!bookingUrl) return "";
    if (!trimmedRef) return bookingUrl;
    const sep = bookingUrl.includes("?") ? "&" : "?";
    return `${bookingUrl}${sep}aff_id=${encodeURIComponent(trimmedRef)}`;
  })();

  async function handleBuy(program: Program) {
    setError(null);
    setLoadingSlug(program.slug);
    try {
      const res = await fetch("/api/partners/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programRef: program.slug,
          affId: trimmedRef || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.url) {
        window.location.href = data.url;
        return;
      }
      setError(data?.error || "Something went wrong starting checkout. Please try again.");
      setLoadingSlug(null);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoadingSlug(null);
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 antialiased">
      {/* ─── Nav ─── */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <a
            href="https://chiefaiofficer.com"
            className="flex items-center gap-2.5"
          >
            <Image
              src="/caio-logo-black.png"
              alt="Chief AI Officer"
              width={512}
              height={512}
              className="h-8 w-8"
              priority
            />
            <span className="text-base font-semibold tracking-tight text-slate-900">
              Chief AI Officer
            </span>
          </a>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-[#1e1b4b] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 50% -5%, rgba(99,102,241,0.55) 0%, transparent 60%), radial-gradient(45% 45% at 85% 20%, rgba(79,70,229,0.35) 0%, transparent 60%), radial-gradient(40% 50% at 10% 30%, rgba(67,56,202,0.30) 0%, transparent 60%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse 70% 70% at 50% 30%, black 30%, transparent 75%)",
          }}
        />

        <div className="relative mx-auto max-w-3xl px-6 pb-20 pt-16 text-center sm:pt-20">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-300/25 bg-indigo-400/10 px-4 py-1.5 text-sm font-medium text-indigo-200">
            <Sparkles className="h-3.5 w-3.5" />
            Chief AI Officer Programs
          </div>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Start your{" "}
            <span className="bg-gradient-to-r from-indigo-300 to-violet-400 bg-clip-text text-transparent">
              Chief AI Officer
            </span>{" "}
            journey
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-indigo-200/90">
            Build your AI leadership capability with the programs shaping how
            companies adopt AI. Book a call to find the right fit — or enroll
            directly below.
          </p>

          {bookingUrl && (
            <div className="mt-9">
              <a
                href={bookingHref}
                className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-[#1e1b4b] shadow-lg shadow-black/20 transition hover:bg-indigo-50"
              >
                <CalendarClock className="h-5 w-5 text-[#4f46e5]" />
                Book a call
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <p className="mt-3 text-sm text-indigo-300/80">
                Recommended first step — we&apos;ll help you find the right program.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ─── Referral code ─── */}
      <section className="bg-[#f7f6fe]">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-7">
            <label
              htmlFor="aff_id"
              className="block text-sm font-semibold text-[#1e1b4b]"
            >
              Referred by an affiliate?
            </label>
            <p className="mt-1 text-sm text-slate-500">
              Your referrer gets credit when you enroll.
            </p>
            <input
              id="aff_id"
              type="text"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="Enter referral code (optional)"
              autoComplete="off"
              spellCheck={false}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#4f46e5] focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>
      </section>

      {/* ─── Programs ─── */}
      <section className="bg-white pb-24 pt-10">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#1e1b4b] sm:text-4xl">
              Enroll directly
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              Ready to get started? Choose a program and check out securely.
            </p>
          </div>

          {error && (
            <div className="mx-auto mb-8 flex max-w-2xl items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {programs.length === 0 ? (
            <p className="text-center text-slate-500">
              No self-serve programs are available right now.{" "}
              {bookingUrl ? "Please book a call to get started." : "Please check back soon."}
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {programs.map((program) => {
                const loading = loadingSlug === program.slug;
                return (
                  <div
                    key={program.id}
                    className="flex flex-col rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/60 p-7 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-bold text-[#1e1b4b]">
                        {program.name}
                      </h3>
                      {program.isSample && (
                        <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
                          Sample only
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold tracking-tight text-[#1e1b4b] tabular-nums">
                        {usd(program.listValueCents)}
                      </span>
                    </div>
                    <div className="mt-auto pt-6">
                      <button
                        type="button"
                        onClick={() => handleBuy(program)}
                        disabled={loading || loadingSlug !== null}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#4f46e5] px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Redirecting…
                          </>
                        ) : (
                          <>
                            Buy now
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-10 text-center">
          <a
            href="https://chiefaiofficer.com"
            className="inline-flex items-center gap-2.5"
          >
            <Image
              src="/caio-logo-black.png"
              alt="Chief AI Officer"
              width={512}
              height={512}
              className="h-6 w-6"
            />
            <span className="text-sm font-semibold text-slate-700">
              Chief AI Officer
            </span>
          </a>
          <p className="text-sm text-slate-500">
            Questions?{" "}
            <a
              href="mailto:dani@chiefaiofficer.com"
              className="font-medium text-[#4f46e5] transition hover:text-[#4338ca]"
            >
              dani@chiefaiofficer.com
            </a>
          </p>
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Chief AI Officer. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
