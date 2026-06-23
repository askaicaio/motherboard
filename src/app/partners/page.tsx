import Link from "next/link";
import {
  CheckCircle,
  Link2,
  DollarSign,
  Clock,
  Users,
  ShieldCheck,
  ChevronRight,
  Award,
  TrendingUp,
  HelpCircle,
} from "lucide-react";

const PROGRAMS = [
  {
    name: "ROI Blueprint",
    listValue: 10_000,
    commission: 1_000,
    salesLed: false,
  },
  {
    name: "AI Leadership Certification",
    listValue: 12_000,
    commission: 1_200,
    salesLed: false,
  },
  {
    name: "CAIO Certification",
    listValue: 12_000,
    commission: 1_200,
    salesLed: false,
  },
  {
    name: "AI Leadership Kickstart Day",
    listValue: 12_000,
    commission: 1_200,
    salesLed: false,
  },
  {
    name: "Strategic Oversight",
    listValue: 43_500,
    commission: 4_350,
    salesLed: true,
  },
  {
    name: "Embedded Fractional CAIO",
    listValue: 54_000,
    commission: 5_400,
    salesLed: true,
  },
];

function usd(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

const STEPS = [
  {
    icon: Award,
    title: "Apply & get your link",
    description:
      "Fill out a short application. Once approved you'll receive a unique referral link with a 60-day attribution cookie.",
  },
  {
    icon: Link2,
    title: "Share it",
    description:
      "Send your link to executives, board members, and leadership teams who are ready to build an AI strategy.",
  },
  {
    icon: DollarSign,
    title: "Earn 10% on first purchase",
    description:
      "When a new customer completes their first purchase through your link, you earn 10% of the program list price — paid Net-45.",
  },
];

const KEY_TERMS = [
  { icon: Clock, label: "Cookie window", value: "60 days" },
  { icon: Users, label: "Eligible customers", value: "New customers only" },
  { icon: TrendingUp, label: "Commission", value: "10% on first purchase" },
  { icon: DollarSign, label: "Payout terms", value: "Net-45" },
  { icon: ShieldCheck, label: "Minimum payout", value: "$100" },
  { icon: CheckCircle, label: "Payout methods", value: "ACH or Zelle" },
];

const FAQS = [
  {
    q: "How does attribution work?",
    a: "When someone clicks your referral link, a 60-day cookie is set in their browser. If they purchase any CAIO program within that window, the conversion is attributed to you. Direct introductions (warm handoffs) are also tracked manually by our team.",
  },
  {
    q: "When do I get paid?",
    a: "Commission is earned after the 30-day refund window closes. Payment is issued Net-45 from the purchase date via ACH or Zelle. The minimum payout threshold is $100.",
  },
  {
    q: "What tax forms are required?",
    a: "U.S. partners must submit a W-9 before their first payout. International partners must submit a W-8BEN (individuals) or W-8BEN-E (entities). We cannot process payouts until a valid tax form is on file.",
  },
  {
    q: "Which programs are eligible?",
    a: "All six CAIO programs are eligible. Sales-led programs (Strategic Oversight, Embedded Fractional CAIO) require a qualified introduction and a deal closed by our team — commission is paid on confirmed closed deals.",
  },
];

export default function PartnersLandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      {/* ─── Nav bar ─── */}
      <header className="sticky top-0 z-50 border-b border-indigo-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold tracking-tight text-[#1e1b4b]">
            Chief AI Officer
          </span>
          <Link
            href="/partners/apply"
            className="rounded-lg bg-[#4f46e5] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4338ca] focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:ring-offset-2"
          >
            Apply now
          </Link>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-[#1e1b4b] py-24 text-white">
        {/* subtle radial gradient accent */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, #4f46e5 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-300">
            <Award className="h-4 w-4" />
            Partner Program
          </div>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Earn 10% referring leaders
            <br />
            <span className="text-indigo-400">to CAIO</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-indigo-200">
            Introduce executives and board members to the Chief AI Officer
            programs. Earn up to{" "}
            <span className="font-semibold text-white">$5,400 per referral</span>{" "}
            with a 60-day cookie, Net-45 payouts, and no cap on earnings.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/partners/apply"
              className="inline-flex items-center gap-2 rounded-lg bg-[#4f46e5] px-8 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-[#4338ca]"
            >
              Apply to become a partner
              <ChevronRight className="h-4 w-4" />
            </Link>
            <a
              href="#programs"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-white/5"
            >
              View commission table
            </a>
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#1e1b4b]">
              How it works
            </h2>
            <p className="mt-3 text-base text-gray-500">
              Three steps from application to your first payout.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="relative rounded-2xl border border-gray-100 bg-gray-50 p-8 shadow-sm"
                >
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50">
                    <Icon className="h-6 w-6 text-[#4f46e5]" />
                  </div>
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-indigo-400">
                    Step {i + 1}
                  </span>
                  <h3 className="mb-2 text-lg font-bold text-[#1e1b4b]">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-600">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Commission table ─── */}
      <section id="programs" className="bg-[#f8f7ff] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#1e1b4b]">
              Commission schedule
            </h2>
            <p className="mt-3 text-base text-gray-500">
              10% flat rate on the program list price for every new customer you
              refer.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-indigo-50 bg-[#1e1b4b] text-left text-xs font-semibold uppercase tracking-wider text-indigo-200">
                  <th className="px-6 py-4">Program</th>
                  <th className="px-6 py-4 text-right">List value</th>
                  <th className="px-6 py-4 text-right">Your commission (10%)</th>
                  <th className="px-6 py-4 text-center">Type</th>
                </tr>
              </thead>
              <tbody>
                {PROGRAMS.map((p, i) => (
                  <tr
                    key={p.name}
                    className={
                      i % 2 === 0 ? "bg-white" : "bg-[#f8f7ff]"
                    }
                  >
                    <td className="px-6 py-4 font-medium text-[#1e1b4b]">
                      {p.name}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-700">
                      {usd(p.listValue * 100)}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-[#4f46e5]">
                      {usd(p.commission * 100)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {p.salesLed ? (
                        <span className="inline-block rounded-full bg-amber-50 px-3 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                          Sales-led
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-green-50 px-3 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200">
                          Self-serve
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-center text-xs text-gray-400">
            Sales-led programs require a qualified introduction and a deal closed
            by the CAIO team.
          </p>
        </div>
      </section>

      {/* ─── Key terms ─── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#1e1b4b]">
              Key terms at a glance
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {KEY_TERMS.map((term) => {
              const Icon = term.icon;
              return (
                <div
                  key={term.label}
                  className="flex items-start gap-4 rounded-xl border border-gray-100 bg-gray-50 p-5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                    <Icon className="h-5 w-5 text-[#4f46e5]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
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
      <section className="bg-[#f8f7ff] py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#1e1b4b]">
              Frequently asked questions
            </h2>
          </div>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div
                key={faq.q}
                className="rounded-xl border border-indigo-100 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#4f46e5]" />
                  <div>
                    <p className="font-semibold text-[#1e1b4b]">{faq.q}</p>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="bg-[#1e1b4b] py-20 text-center text-white">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-3xl font-bold tracking-tight">
            Ready to start earning?
          </h2>
          <p className="mt-4 text-lg text-indigo-200">
            Apply in minutes. Once approved, you&apos;ll receive your unique
            referral link and can start earning the same day.
          </p>
          <Link
            href="/partners/apply"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#4f46e5] px-8 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-[#4338ca]"
          >
            Apply to the partner program
            <ChevronRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-xs text-indigo-400">
            No cost to join. Application review within 2 business days.
          </p>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-gray-100 bg-white py-8 text-center text-xs text-gray-400">
        <p>
          &copy; {new Date().getFullYear()} Chief AI Officer. All rights
          reserved.
        </p>
        <p className="mt-1">
          Questions?{" "}
          <a
            href="mailto:partners@chiefaiofficer.com"
            className="text-[#4f46e5] hover:underline"
          >
            partners@chiefaiofficer.com
          </a>
        </p>
      </footer>
    </div>
  );
}
