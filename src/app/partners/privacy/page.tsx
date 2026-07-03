import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Privacy Policy — CAIO Affiliate Program",
  description:
    "How the Chief AI Officer Affiliate Program collects, uses, and protects your information.",
};

const LAST_UPDATED = "June 2026";

export default function AffiliatePrivacyPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 antialiased">
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
              className="h-8 w-auto"
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
            Privacy Policy
          </h1>
          <p className="mt-4 text-indigo-200/90">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* ─── Body ─── */}
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-900">
          This is a plain-language summary of how we handle your information as a
          participant in the Chief AI Officer (“CAIO”) Affiliate Program. It
          should be read alongside, and is governed by, the binding Partner
          Program Terms and the main{" "}
          <a href="https://chiefaiofficer.com" className="font-semibold underline">
            chiefaiofficer.com
          </a>{" "}
          privacy policy.
        </div>

        <div className="prose-section mt-12 space-y-10">
          <Section title="Who this covers">
            <p>
              This policy applies to people who apply to or participate in the
              CAIO Affiliate Program — including applicants, approved affiliates,
              and visitors who arrive through an affiliate referral link. It
              describes the data the affiliate program itself collects, separate
              from any purchase you might make as a CAIO customer.
            </p>
          </Section>

          <Section title="What we collect">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Application information</strong> — your name, email,
                mailing address, date of birth, profession, audience details,
                promotion platforms, and the answers you provide on the
                affiliate application form.
              </li>
              <li>
                <strong>Tax and payout information</strong> — your W-9 or
                W-8BEN/W-8BEN-E tax form and the payout details (ACH or Zelle)
                required to pay your commissions.
              </li>
              <li>
                <strong>Referral tracking cookies</strong> — when someone clicks
                your referral link we set a first-party cookie (with a 60-day
                attribution window) so we can credit qualifying purchases to you.
              </li>
              <li>
                <strong>Click and conversion data</strong> — the clicks on your
                links, the conversions attributed to you, commission status, and
                payout history shown in your affiliate portal.
              </li>
              <li>
                <strong>Account and security data</strong> — login credentials
                and basic technical logs used to operate and secure the portal.
              </li>
            </ul>
          </Section>

          <Section title="How we use it">
            <ul className="list-disc space-y-2 pl-5">
              <li>To review your application and operate your affiliate account.</li>
              <li>
                To attribute referrals, calculate commissions, and process your
                payouts.
              </li>
              <li>
                To meet our tax, accounting, and legal obligations (including
                issuing any required tax documents).
              </li>
              <li>
                To detect and prevent fraud, self-referrals, and abuse of the
                program.
              </li>
              <li>
                To send you program-related communications such as approval
                notices, payout updates, and material changes to the terms.
              </li>
            </ul>
          </Section>

          <Section title="How we share it">
            <p>
              We do not sell your personal information. We share it only with
              service providers who help us run the program — for example payment
              processors, tax and accounting providers, email delivery, and
              hosting — and only as needed for them to perform those services. We
              may also disclose information where required by law.
            </p>
          </Section>

          <Section title="Cookies and tracking">
            <p>
              Referral attribution relies on a first-party cookie set when a
              visitor clicks your link. If a visitor blocks or clears cookies,
              the referral may not be attributed. We use this data solely to
              credit affiliates and report on program performance.
            </p>
          </Section>

          <Section title="Data retention">
            <p>
              We keep application and account data for as long as your affiliate
              account is active. After an account closes, we retain tax, payout,
              and transaction records for as long as required to satisfy our
              financial and legal obligations, then delete or anonymize them.
              Referral cookies expire automatically at the end of their 60-day
              window.
            </p>
          </Section>

          <Section title="Your choices">
            <p>
              You may request access to, correction of, or deletion of your
              personal information, subject to records we are legally required to
              keep. You can also unsubscribe from non-essential program emails at
              any time. To make a request, contact us using the details below.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy or your data? Email{" "}
              <a
                href="mailto:privacy@chiefaiofficer.com"
                className="font-semibold text-[#4f46e5] underline"
              >
                privacy@chiefaiofficer.com
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-14 border-t border-slate-100 pt-8 text-sm text-slate-500">
          See also our{" "}
          <Link href="/partners/terms" className="font-semibold text-[#4f46e5] hover:underline">
            Terms &amp; Conditions
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
          className="flex items-center"
          aria-label="Chief AI Officer — in partnership with Scaling Up"
        >
          <Image
            src="/caio-scalingup.png"
            alt="Chief AI Officer — in partnership with Scaling Up"
            width={4000}
            height={1000}
            className="h-6 w-auto"
          />
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
