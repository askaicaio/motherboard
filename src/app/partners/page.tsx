import Link from "next/link";
import Image from "next/image";
import {
  Link2,
  DollarSign,
  Clock,
  Users,
  ShieldCheck,
  ChevronRight,
  Award,
  TrendingUp,
  Handshake,
  Sparkles,
  BadgeCheck,
  ArrowRight,
} from "lucide-react";

import type { Metadata } from "next";

const SITE_URL = "https://affiliates.chiefaiofficer.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title:
    "CAIO Affiliate Program — Earn 10% Referring AI Leadership Programs",
  description:
    "Earn 10% commissions (up to $5,400 per referral) introducing executives to Chief AI Officer programs. 60-day cookie, Net-45 payouts, no cap on earnings.",
  keywords: [
    "affiliate program",
    "AI consulting affiliate",
    "refer AI leadership",
    "AI leadership program affiliate",
    "Chief AI Officer affiliate",
    "high-ticket affiliate program",
    "AI strategy referral program",
    "executive education affiliate",
  ],
  alternates: {
    canonical: "https://affiliates.chiefaiofficer.com/",
  },
  openGraph: {
    title:
      "CAIO Affiliate Program — Earn 10% Referring AI Leadership Programs",
    description:
      "Earn 10% commissions (up to $5,400 per referral) introducing executives to Chief AI Officer programs. 60-day cookie, Net-45 payouts, no cap on earnings.",
    url: "https://affiliates.chiefaiofficer.com/",
    siteName: "Chief AI Officer",
    type: "website",
    images: [
      {
        url: "/caio-logo-purple.png",
        width: 512,
        height: 512,
        alt: "Chief AI Officer Affiliate Program",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "CAIO Affiliate Program — Earn 10% Referring AI Leadership Programs",
    description:
      "Earn 10% commissions (up to $5,400 per referral) introducing executives to Chief AI Officer programs. 60-day cookie, Net-45 payouts.",
    images: ["/caio-logo-purple.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://chiefaiofficer.com/#organization",
      name: "Chief AI Officer",
      url: "https://chiefaiofficer.com",
      logo: "https://affiliates.chiefaiofficer.com/caio-logo-purple.png",
      description:
        "Chief AI Officer runs the programs shaping how executives and boards adopt AI strategy.",
    },
    {
      "@type": "WebPage",
      "@id": "https://affiliates.chiefaiofficer.com/#webpage",
      url: "https://affiliates.chiefaiofficer.com/",
      name: "CAIO Affiliate Program — Earn 10% Referring AI Leadership Programs",
      description:
        "Earn 10% commissions (up to $5,400 per referral) introducing executives to Chief AI Officer programs. 60-day cookie, Net-45 payouts, no cap on earnings.",
      isPartOf: { "@id": "https://chiefaiofficer.com/#organization" },
      primaryImageOfPage:
        "https://affiliates.chiefaiofficer.com/caio-logo-purple.png",
    },
    {
      "@type": "Offer",
      name: "CAIO Affiliate Program",
      description:
        "Earn a flat 10% commission on every new-customer first purchase across all Chief AI Officer programs, up to $5,400 per referral.",
      url: "https://affiliates.chiefaiofficer.com/",
      category: "Affiliate Program",
      priceCurrency: "USD",
      eligibleQuantity: {
        "@type": "QuantitativeValue",
        value: 10,
        unitText: "PERCENT",
      },
      offeredBy: { "@id": "https://chiefaiofficer.com/#organization" },
    },
  ],
};

const PROGRAMS = [
  { name: "ROI Blueprint", listValue: 10_000, commission: 1_000, salesLed: false },
  { name: "AI Leadership Certification", listValue: 12_000, commission: 1_200, salesLed: false },
  { name: "CAIO Certification", listValue: 12_000, commission: 1_200, salesLed: false },
  { name: "AI Leadership Kickstart Day", listValue: 12_000, commission: 1_200, salesLed: false },
  { name: "Embedded Fractional CAIO", listValue: 54_000, commission: 5_400, salesLed: true },
];

function usd(dollars: number) {
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

const STATS = [
  { value: "$5,400", label: "Top commission per referral" },
  { value: "60 days", label: "Attribution cookie" },
  { value: "Net-45", label: "Reliable payouts" },
  { value: "No cap", label: "On total earnings" },
];

const VALUE_PROPS = [
  {
    icon: TrendingUp,
    title: "High-ticket commissions",
    body: "Programs run from $10,000 to $54,000. A single referral can earn you up to $5,400 — far beyond typical affiliate payouts.",
  },
  {
    icon: BadgeCheck,
    title: "A brand executives trust",
    body: "Chief AI Officer is where leaders go to build a real AI strategy. You're introducing people to something they'll thank you for.",
  },
  {
    icon: Handshake,
    title: "You just make the intro",
    body: "Share your link or introduce a prospect directly. We handle the sale, onboarding, and delivery — you earn on the outcome.",
  },
];

const STEPS = [
  {
    icon: Award,
    title: "Apply & get your link",
    description:
      "Complete a short application. Once approved, you receive a unique referral link with a 60-day attribution window.",
  },
  {
    icon: Link2,
    title: "Share it or introduce",
    description:
      "Send your link to executives and boards, or introduce a prospect directly for the enterprise engagements.",
  },
  {
    icon: DollarSign,
    title: "Earn 10% on first purchase",
    description:
      "When a new customer makes their first purchase, you earn 10% — paid Net-45 once the refund window closes.",
  },
];

const KEY_TERMS = [
  { icon: TrendingUp, label: "Commission", value: "10% on first purchase" },
  { icon: Clock, label: "Cookie window", value: "60 days" },
  { icon: Users, label: "Eligible customers", value: "New customers only" },
  { icon: DollarSign, label: "Payout terms", value: "Net-45, monthly" },
  { icon: ShieldCheck, label: "Minimum payout", value: "$100 (rolls over)" },
  { icon: BadgeCheck, label: "Payout methods", value: "ACH or Zelle" },
];

const FAQS = [
  {
    q: "How does attribution work?",
    a: "When someone clicks your referral link, a 60-day cookie is set. If they purchase any eligible CAIO program within that window, the conversion is attributed to you. For enterprise deals, a documented direct introduction — logged before any proposal — is tracked the same way.",
  },
  {
    q: "When do I get paid?",
    a: "A commission becomes earned once the 7-day refund window passes without a refund or chargeback. Earned commissions are paid Net-45 after the end of the month, via ACH or Zelle. Balances under the $100 minimum roll forward to the next cycle.",
  },
  {
    q: "Who counts as a referral?",
    a: "Commission is paid on the first purchase by a genuinely new customer — someone with no prior CAIO purchase. Renewals, upgrades, and expansions by existing customers are not commissionable.",
  },
  {
    q: "What tax forms are required?",
    a: "U.S. affiliates submit a W-9 before their first payout; international affiliates submit a W-8BEN (individuals) or W-8BEN-E (entities). We can't issue a payout until a valid form is on file.",
  },
  {
    q: "Which programs are eligible?",
    a: "Every CAIO program. The self-serve programs are purchased directly through your link; the sales-led engagement (Embedded Fractional CAIO) is attributed through a qualified introduction and paid when our team closes the deal.",
  },
  {
    q: "How do I get my referral link?",
    a: "Once your application is approved, your unique referral link is generated automatically and waiting for you in the affiliate portal. You can copy it from your dashboard and start sharing the same day.",
  },
  {
    q: "How are sales-led programs (like Embedded Fractional CAIO) credited?",
    a: "You make a documented introduction — log it in your portal before any proposal goes out. A CAIO admin records the deal once it closes, and your commission is calculated exactly the same way as a self-serve referral: a flat 10% of the first purchase.",
  },
  {
    q: "What happens if a sale is refunded?",
    a: "Commissions are only confirmed after the 7-day refund window closes. If a purchase is refunded or charged back during that window, the related commission is reversed and won't be paid out. Refunds after a commission has already been paid are reconciled against your next balance.",
  },
  {
    q: "Is there a cap on earnings?",
    a: "No. There's no cap on how much you can earn — refer one executive or a hundred, you earn 10% on every qualifying new-customer first purchase.",
  },
  {
    q: "How long does approval take?",
    a: "We review every application personally to keep the program high-quality, so it usually takes about 3 business days. We'll email you the moment you're approved with a link to set up your portal.",
  },
  {
    q: "Can I see my clicks and conversions?",
    a: "Yes. Your affiliate portal shows your clicks, attributed conversions, pending and earned commissions, and payout history in real time — so you always know where you stand.",
  },
  {
    q: "What counts as a new customer?",
    a: "A new customer is someone with no prior CAIO purchase. Commission is paid on their first purchase only — renewals, upgrades, and expansions by existing customers are not commissionable.",
  },
];

export default function PartnersLandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      {/* ─── Nav ─── */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <a
            href="https://chiefaiofficer.com"
            className="flex items-center"
            aria-label="Chief AI Officer — in partnership with Scaling Up"
          >
            <Image
              src="/caio-scalingup.png"
              alt="Chief AI Officer — in partnership with Scaling Up"
              width={4000}
              height={1000}
              className="h-9 w-auto sm:h-10"
              priority
            />
          </a>
          <div className="flex items-center gap-5">
            <Link
              href="/portal/login"
              className="hidden text-sm font-medium text-slate-600 transition hover:text-[#4f46e5] sm:inline"
            >
              Sign in
            </Link>
            <Link
              href="/partners/apply"
              className="rounded-full bg-[#4f46e5] px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-[#4338ca]"
            >
              Apply now
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-[#1e1b4b] text-white">
        {/* layered gradient mesh */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 50% -5%, rgba(99,102,241,0.55) 0%, transparent 60%), radial-gradient(45% 45% at 85% 20%, rgba(79,70,229,0.35) 0%, transparent 60%), radial-gradient(40% 50% at 10% 30%, rgba(67,56,202,0.30) 0%, transparent 60%)",
          }}
        />
        {/* faint grid */}
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

        <div className="relative mx-auto max-w-4xl px-6 pb-24 pt-20 text-center sm:pt-24">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-300/25 bg-indigo-400/10 px-4 py-1.5 text-sm font-medium text-indigo-200">
            <Sparkles className="h-3.5 w-3.5" />
            CAIO Affiliate Program
          </div>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Earn 10% introducing leaders to{" "}
            <span className="bg-gradient-to-r from-indigo-300 to-violet-400 bg-clip-text text-transparent">
              Chief AI Officer
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-indigo-200/90">
            Introduce executives and boards to the programs shaping how
            companies adopt AI — and earn up to{" "}
            <span className="font-semibold text-white">$5,400 per referral</span>,
            with a 60-day cookie and Net-45 payouts.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/partners/apply"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-[#1e1b4b] shadow-lg shadow-black/20 transition hover:bg-indigo-50"
            >
              Become an affiliate
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#programs"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white/5"
            >
              See what you earn
            </a>
          </div>

          {/* stat strip */}
          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="bg-[#1e1b4b]/60 px-5 py-5 backdrop-blur">
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-indigo-300/80">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Why affiliate ─── */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#1e1b4b] sm:text-4xl">
              Built for serious referrers
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              High-value programs, a brand executives respect, and a process
              that does the heavy lifting for you.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {VALUE_PROPS.map((v) => {
              const Icon = v.icon;
              return (
                <div
                  key={v.title}
                  className="rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/60 p-8 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
                >
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 ring-1 ring-inset ring-indigo-600/20">
                    <Icon className="h-6 w-6 text-[#4f46e5]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#1e1b4b]">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {v.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="bg-[#f7f6fe] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#1e1b4b] sm:text-4xl">
              From intro to payout in three steps
            </h2>
          </div>
          <div className="relative grid gap-8 sm:grid-cols-3">
            {/* connecting line */}
            <div
              aria-hidden
              className="absolute left-0 right-0 top-[34px] hidden border-t border-dashed border-indigo-200 sm:block"
            />
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="relative text-center sm:text-left">
                  <div className="relative z-10 mx-auto mb-5 flex h-[68px] w-[68px] items-center justify-center rounded-2xl border border-indigo-100 bg-white shadow-sm sm:mx-0">
                    <Icon className="h-7 w-7 text-[#4f46e5]" />
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#4f46e5] text-xs font-bold text-white shadow">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#1e1b4b]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Commission table ─── */}
      <section id="programs" className="bg-white py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#1e1b4b] sm:text-4xl">
              What you earn
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              A flat 10% on every new-customer first purchase. No tiers, no
              decoding.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm shadow-indigo-100/50">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-[#1e1b4b] text-xs font-semibold uppercase tracking-wider text-indigo-200">
                  <th className="px-6 py-4">Program</th>
                  <th className="px-6 py-4 text-right">Engagement value</th>
                  <th className="px-6 py-4 text-right">Your commission</th>
                  <th className="hidden px-6 py-4 text-center sm:table-cell">How it&apos;s referred</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PROGRAMS.map((p) => (
                  <tr key={p.name} className="bg-white transition hover:bg-indigo-50/40">
                    <td className="px-6 py-4 font-semibold text-[#1e1b4b]">
                      {p.name}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums text-slate-600">
                      {usd(p.listValue)}
                    </td>
                    <td className="px-6 py-4 text-right text-base font-bold tabular-nums text-[#4f46e5]">
                      {usd(p.commission)}
                    </td>
                    <td className="hidden px-6 py-4 text-center sm:table-cell">
                      {p.salesLed ? (
                        <span className="inline-block rounded-full bg-amber-50 px-3 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                          Introduction
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                          Referral link
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">
            “Introduction” programs are enterprise engagements — attribute them
            with a documented intro and we close the deal together.
          </p>
        </div>
      </section>

      {/* ─── Key terms ─── */}
      <section className="bg-[#f7f6fe] py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#1e1b4b] sm:text-4xl">
              The terms, in plain sight
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {KEY_TERMS.map((term) => {
              const Icon = term.icon;
              return (
                <div
                  key={term.label}
                  className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600/10 ring-1 ring-inset ring-indigo-600/15">
                    <Icon className="h-5 w-5 text-[#4f46e5]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {term.label}
                    </p>
                    <p className="mt-0.5 text-base font-semibold text-[#1e1b4b]">
                      {term.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#1e1b4b] sm:text-4xl">
              Questions, answered
            </h2>
          </div>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white shadow-sm">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-[#1e1b4b]">
                  {faq.q}
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#4f46e5] transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="relative overflow-hidden bg-[#1e1b4b] py-24 text-center text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 80% at 50% 120%, rgba(99,102,241,0.5) 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-2xl px-6">
          <Image
            src="/caio-scalingup-white.png"
            alt="Chief AI Officer — in partnership with Scaling Up"
            width={4000}
            height={1000}
            className="mx-auto mb-6 h-10 w-auto opacity-95"
          />
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Start earning with your network
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-indigo-200">
            Apply in minutes. Once approved, your referral link is live the same
            day — and there&apos;s no cap on what you can earn.
          </p>
          <Link
            href="/partners/apply"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-[#1e1b4b] shadow-lg shadow-black/20 transition hover:bg-indigo-50"
          >
            Apply to the Affiliate Program
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-xs text-indigo-300/80">
            No cost to join · Applications reviewed within 2 business days
          </p>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-2">
            <a
              href="https://chiefaiofficer.com"
              className="inline-flex items-center"
              aria-label="Chief AI Officer — in partnership with Scaling Up"
            >
              <Image
                src="/caio-scalingup.png"
                alt="Chief AI Officer — in partnership with Scaling Up"
                width={4000}
                height={1000}
                className="h-7 w-auto"
              />
            </a>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
              Earn 10% introducing executives and boards to the programs shaping
              how companies adopt AI.
            </p>
          </div>

          {/* Affiliate program */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Affiliate program
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
              <li>
                <Link href="/partners/apply" className="transition hover:text-[#4f46e5]">
                  Apply
                </Link>
              </li>
              <li>
                <Link href="/portal/login" className="transition hover:text-[#4f46e5]">
                  Sign in
                </Link>
              </li>
              <li>
                <a
                  href="mailto:partners@chiefaiofficer.com"
                  className="transition hover:text-[#4f46e5]"
                >
                  partners@chiefaiofficer.com
                </a>
              </li>
            </ul>
          </div>

          {/* Related links */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Related links
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
              <li>
                <a
                  href="https://chiefaiofficer.com"
                  className="transition hover:text-[#4f46e5]"
                >
                  Main website
                </a>
              </li>
              <li>
                {/* TODO: confirm real podcast URL — using /podcast as a placeholder */}
                <a
                  href="https://chiefaiofficer.com/podcast"
                  className="transition hover:text-[#4f46e5]"
                >
                  “Using AI at Work” podcast
                </a>
              </li>
              <li>
                <Link href="/partners/privacy" className="transition hover:text-[#4f46e5]">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/partners/terms" className="transition hover:text-[#4f46e5]">
                  Terms &amp; Conditions
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-50 py-4 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} Chief AI Officer. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
