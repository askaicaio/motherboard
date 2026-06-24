import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Terms & Conditions — CAIO Affiliate Program",
  description:
    "A plain-language summary of the Chief AI Officer Affiliate Program terms — commission, attribution, eligibility, and payouts.",
};

const LAST_UPDATED = "June 2026";

export default function AffiliateTermsPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 antialiased">
      {/* ─── Nav ─── */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
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

      {/* ─── Title ─── */}
      <section className="relative overflow-hidden bg-[#1e1b4b] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(55% 60% at 50% -10%, rgba(99,102,241,0.5) 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-16 sm:pt-20">
          <p className="text-sm font-medium uppercase tracking-wider text-indigo-300/80">
            CAIO Affiliate Program
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Terms &amp; Conditions
          </h1>
          <p className="mt-4 text-indigo-200/90">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* ─── Body ─── */}
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-900">
          This is a plain-language summary of the Chief AI Officer (“CAIO”)
          Affiliate Program, provided for convenience only. The binding Partner
          Program Terms you accept when you apply or are approved govern your
          participation; if anything here conflicts with those terms, the Partner
          Program Terms control.
        </div>

        <div className="mt-12 space-y-10">
          <Section title="Commission">
            <p>
              Approved affiliates earn a flat <strong>10% commission</strong> on
              the first purchase made by a qualifying new customer. There are no
              tiers and no cap on total earnings.
            </p>
          </Section>

          <Section title="Attribution &amp; cookie window">
            <p>
              When a visitor clicks your referral link, a <strong>60-day</strong>{" "}
              attribution cookie is set. If they make a qualifying purchase within
              that window, the conversion is credited to you. Attribution is{" "}
              <strong>first-attribution-wins</strong> — where more than one
              affiliate is involved, the earliest valid referral is credited. For
              sales-led engagements, a documented direct introduction logged before
              any proposal is attributed the same way.
            </p>
          </Section>

          <Section title="Eligible customers">
            <p>
              Commissions are paid only on the first purchase by a genuinely{" "}
              <strong>new customer</strong> — someone with no prior CAIO
              purchase. Renewals, upgrades, and expansions by existing customers
              are not commissionable. Self-referrals and purchases for your own
              benefit are not eligible.
            </p>
          </Section>

          <Section title="Refund &amp; dispute window">
            <p>
              A commission is confirmed only after the refund window on the
              underlying sale closes without a refund or chargeback. You have a{" "}
              <strong>14-day window</strong> to dispute the calculation or
              attribution of a recorded commission. After that window, recorded
              amounts are treated as final.
            </p>
          </Section>

          <Section title="Payouts">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Earned commissions are paid <strong>Net-45</strong> via{" "}
                <strong>ACH or Zelle</strong>.
              </li>
              <li>
                A <strong>$100 minimum</strong> applies; balances below the
                minimum roll forward to the next payout cycle.
              </li>
              <li>
                We cannot issue a payout until a valid tax form is on file (see
                below).
              </li>
            </ul>
          </Section>

          <Section title="Tax forms">
            <p>
              U.S. affiliates must submit a <strong>W-9</strong> before their
              first payout. International affiliates must submit a{" "}
              <strong>W-8BEN</strong> (individuals) or <strong>W-8BEN-E</strong>{" "}
              (entities). Payouts are withheld until a valid form is received.
            </p>
          </Section>

          <Section title="Promotion conduct">
            <p>
              You agree to promote CAIO honestly and lawfully — no spam, no
              misleading claims, no trademark or paid-search bidding abuse, and no
              cookie stuffing or incentivized clicks. You are responsible for
              complying with applicable advertising and disclosure laws.
            </p>
          </Section>

          <Section title="Suspension &amp; termination">
            <p>
              We may suspend or terminate your participation, withhold or reverse
              commissions, and disable your referral link if we reasonably believe
              you have breached these terms, engaged in fraud, or harmed the CAIO
              brand. Either party may end participation at any time; commissions
              already earned and confirmed will be paid in the normal cycle.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              We may update the program terms from time to time. Material changes
              will be communicated to active affiliates, and your continued
              participation after a change takes effect constitutes acceptance.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about the program? Email{" "}
              <a
                href="mailto:partners@chiefaiofficer.com"
                className="font-semibold text-[#4f46e5] underline"
              >
                partners@chiefaiofficer.com
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-14 border-t border-slate-100 pt-8 text-sm text-slate-500">
          See also our{" "}
          <Link href="/partners/privacy" className="font-semibold text-[#4f46e5] hover:underline">
            Privacy Policy
          </Link>
          .
        </div>
      </main>

      {/* ─── Footer ─── */}
      <LegalFooter />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-bold tracking-tight text-[#1e1b4b]">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-slate-600">
        {children}
      </div>
    </section>
  );
}

function LegalFooter() {
  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <a
          href="https://chiefaiofficer.com"
          className="flex items-center gap-2.5"
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
        <div className="flex items-center gap-6 text-sm text-slate-500">
          <Link href="/partners" className="transition hover:text-[#4f46e5]">
            Affiliate home
          </Link>
          <Link href="/partners/privacy" className="transition hover:text-[#4f46e5]">
            Privacy
          </Link>
          <Link href="/partners/terms" className="transition hover:text-[#4f46e5]">
            Terms
          </Link>
        </div>
      </div>
      <div className="border-t border-slate-50 py-4 text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Chief AI Officer. All rights reserved.
      </div>
    </footer>
  );
}
