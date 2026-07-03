// Partner Program — TEAM-ONLY affiliate testing guide (server component).
//
// Privacy is belt-and-suspenders:
//   1) requireAuth() gates the whole route to signed-in staff, so it's already
//      private (not reachable by the public or by affiliates).
//   2) We still export metadata with robots noindex/nofollow so that — in the
//      unlikely event a URL leaks — Google won't index or follow it.
//
// This is a static walkthrough (no DB reads). It documents how to test the full
// affiliate user + money journey end-to-end in Stripe TEST mode.

import { requireAuth } from "@/lib/auth/guard";
import {
  FlaskConical,
  ShieldCheck,
  ListChecks,
  UserRound,
  CreditCard,
  Workflow,
  AlertTriangle,
  Info,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import NextLink from "next/link";

export const metadata = {
  title: "Affiliate Testing Guide",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// ── Small presentational helpers ─────────────────────────────────────────────

/** Inline monospace token for literal values (routes, cards, env vars, codes). */
function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[12px] text-zinc-800">
      {children}
    </code>
  );
}

/** Numbered step row with a circled index. */
function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white tabular-nums">
        {n}
      </span>
      <div className="min-w-0 flex-1 pb-1">
        <p className="text-sm font-medium text-zinc-900">{title}</p>
        {children ? (
          <div className="mt-1 text-sm leading-relaxed text-zinc-600">
            {children}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** Section shell — icon + title + description, then arbitrary body. */
function Section({
  icon: Icon,
  eyebrow,
  title,
  desc,
  children,
}: {
  icon: typeof UserRound;
  eyebrow: string;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
          <Icon className="h-4.5 w-4.5 text-zinc-700" />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            {eyebrow}
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            {title}
          </h2>
          {desc ? <p className="mt-0.5 text-sm text-zinc-500">{desc}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Colored callout box. `tone` drives border/background/icon color. */
function Callout({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: "amber" | "sky" | "emerald";
  icon: typeof Info;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        tone === "amber" && "border-amber-200 bg-amber-50",
        tone === "sky" && "border-sky-200 bg-sky-50",
        tone === "emerald" && "border-emerald-200 bg-emerald-50",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            "h-4 w-4",
            tone === "amber" && "text-amber-600",
            tone === "sky" && "text-sky-600",
            tone === "emerald" && "text-emerald-600",
          )}
        />
        <span
          className={cn(
            "text-sm font-semibold",
            tone === "amber" && "text-amber-900",
            tone === "sky" && "text-sky-900",
            tone === "emerald" && "text-emerald-900",
          )}
        >
          {title}
        </span>
      </div>
      <div
        className={cn(
          "mt-2 text-sm leading-relaxed",
          tone === "amber" && "text-amber-800",
          tone === "sky" && "text-sky-800",
          tone === "emerald" && "text-emerald-800",
        )}
      >
        {children}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AffiliateTestingGuidePage() {
  await requireAuth();

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      {/* Header */}
      <div className="space-y-4">
        <NextLink
          href="/partner-program"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Affiliate Program
        </NextLink>

        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
            <FlaskConical className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Affiliate Testing Guide
              </h1>
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Team only
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              How to test the full affiliate journey. Do all of this in Stripe{" "}
              <strong className="font-semibold text-zinc-700">TEST mode</strong>{" "}
              — no real money moves.
            </p>
          </div>
        </div>

        {/* Demo login */}
        <Card className="border-zinc-200">
          <CardContent className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Demo affiliate login
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Mono>demo@chiefaiofficer.com</Mono>
              <span className="text-zinc-300">/</span>
              <Mono>CaioDemo2026!</Mono>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Prerequisites */}
      <Section
        icon={ListChecks}
        eyebrow="Before you start"
        title="Prerequisites"
        desc="Confirm the environment is wired up. Skipping these is the usual reason a test 'silently' fails."
      >
        <Callout tone="sky" icon={ShieldCheck} title="Environment checklist">
          <ul className="space-y-2.5">
            <li className="flex gap-2">
              <span className="text-sky-400">▢</span>
              <span>
                Stripe is in <strong>TEST mode</strong> and the app&apos;s{" "}
                <Mono>STRIPE_SECRET_KEY</Mono> (or <Mono>STRIPE_API_KEY</Mono>)
                is the <Mono>sk_test_…</Mono> key.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-sky-400">▢</span>
              <span>
                A TEST-mode Stripe webhook points at{" "}
                <Mono>/api/stripe/webhook</Mono>, and{" "}
                <Mono>STRIPE_WEBHOOK_SECRET</Mono> is that test webhook&apos;s
                signing secret.{" "}
                <em className="text-sky-700">
                  Without this, the payment succeeds but the conversion
                  won&apos;t auto-appear.
                </em>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-sky-400">▢</span>
              <span>
                Vercel Blob connected (public <Mono>affiliates-system</Mono> +
                private <Mono>affiliates-tax-forms</Mono>{" "}
                <Mono>TAX_BLOB_READ_WRITE_TOKEN</Mono>).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-sky-400">▢</span>
              <span>
                GHL: <Mono>GHL_B2B_API_TOKEN</Mono> +{" "}
                <Mono>GHL_B2B_LOCATION_ID</Mono> set.
              </span>
            </li>
          </ul>
        </Callout>
      </Section>

      {/* Part 1 */}
      <Section
        icon={UserRound}
        eyebrow="Part 1"
        title="Affiliate user journey"
        desc="Apply → approve → sign in → explore the portal."
      >
        <Card>
          <CardContent className="p-5">
            <ol className="space-y-4">
              <Step n={1} title="Apply">
                Go to <Mono>/partners/apply</Mono>, fill the form, upload any PDF
                as the tax form, submit → you land on the thank-you page; the
                applicant gets a confirmation email and <Mono>partners@</Mono>{" "}
                gets a notification.
              </Step>
              <Step n={2} title="Approve">
                Affiliates → Applications → Approve the applicant. They flip to{" "}
                <strong>Active</strong> and get an email with a temporary
                password. (The &quot;Tax form&quot; button on the application
                opens the uploaded PDF.)
              </Step>
              <Step n={3} title="Portal sign-in">
                <Mono>/portal/login</Mono> with the temp password → you&apos;re
                forced to set a new password → land on the dashboard (referral
                link + stats).
              </Step>
              <Step n={4} title="Explore the portal">
                Copy the referral link, open Resources + Toolkit, file a test
                dispute.
              </Step>
              <Step n={5} title={<>&quot;View as&quot;</>}>
                From Affiliates → Partners, click &quot;View as&quot; on an
                active affiliate → opens their portal read-only with an{" "}
                <strong>&quot;Admin preview&quot;</strong> banner.
              </Step>
            </ol>
          </CardContent>
        </Card>
      </Section>

      {/* Part 2 */}
      <Section
        icon={CreditCard}
        eyebrow="Part 2 · the important one"
        title="Customer + money journey"
        desc="Referral click → checkout → conversion → payout → transfer."
      >
        <Card>
          <CardContent className="p-5">
            <ol className="space-y-4">
              <Step n={1} title="Settings">
                Affiliates → Settings → temporarily set{" "}
                <strong>Minimum payout = $0</strong> (restore to $100 after).
                (Refund window handled by &quot;Mark earned now&quot; in step 7.)
              </Step>
              <Step n={2} title="Connect payout">
                Sign in as the demo affiliate → Payouts → &quot;Connect payout
                account&quot; → click through Stripe&apos;s Express test
                onboarding (use its test-data shortcuts). Status flips to{" "}
                <strong>Ready</strong>.
              </Step>
              <Step n={3} title="Click the referral link">
                Visit <Mono>/r?aff=DEMO2026</Mono> → it redirects to the booking
                page and drops the attribution cookie. (Or go straight to{" "}
                <Mono>/enroll</Mono>.)
              </Step>
              <Step n={4} title="Buy">
                At <Mono>/enroll</Mono>, confirm the referral box shows{" "}
                <Mono>DEMO2026</Mono>, buy &quot;Test Product ($1)&quot; with
                test card <Mono>4242 4242 4242 4242</Mono>, expiry{" "}
                <Mono>12/34</Mono>, CVC <Mono>123</Mono>, any ZIP.
              </Step>
              <Step n={5} title="See the payment">
                Stripe (Test) → Payments — the $1 charge appears, tagged with the{" "}
                <Mono>aff_id</Mono>.
              </Step>
              <Step n={6} title="See the conversion">
                Affiliates → Events → Activity — the conversion appears, credited
                to the Demo Affiliate (<Mono>$0.10</Mono> commission).
              </Step>
              <Step n={7} title="Clear the refund window">
                On that conversion&apos;s &quot;…&quot; menu → &quot;Mark earned
                now&quot; → it flips <Mono>pending</Mono> → <Mono>earned</Mono>.
              </Step>
              <Step n={8} title="Pay out">
                Events → Payouts → Generate batch → the <Mono>$0.10</Mono>{" "}
                auto-transfers to the connected account.
              </Step>
              <Step n={9} title="Verify the transfer">
                Stripe → Connect → Transfers — a transfer labeled{" "}
                <Mono>
                  CAIO affiliate commission — demo@chiefaiofficer.com
                </Mono>
                .
              </Step>
              <Step n={10} title="Restore">
                Settings → Minimum payout back to <strong>$100</strong>.
              </Step>
            </ol>
          </CardContent>
        </Card>
      </Section>

      {/* Part 3 */}
      <Section
        icon={Workflow}
        eyebrow="Part 3"
        title="GHL checks"
        desc="Confirm contacts sync and get tagged in the B2B subaccount."
      >
        <Card>
          <CardContent className="space-y-4 p-5">
            <div>
              <p className="text-sm font-medium text-zinc-900">
                Affiliate sync
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                After approving, the daily sync (or a manual run of{" "}
                <Mono>/api/cron/sync-ghl-affiliates</Mono>) upserts the affiliate
                as a GHL contact tagged <Mono>affiliate-partner</Mono> in the B2B
                subaccount.
              </p>
            </div>
            <div className="border-t border-zinc-100 pt-4">
              <p className="text-sm font-medium text-zinc-900">
                Conversion tagging
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                After a conversion, the <strong>buyer&apos;s</strong> GHL contact
                is upserted + tagged <Mono>affiliate-referral</Mono> with a note
                naming the referring affiliate.
              </p>
            </div>
            <div className="border-t border-zinc-100 pt-4">
              <p className="text-sm font-medium text-zinc-900">
                Roadmap lead{" "}
                <span className="text-xs font-normal text-zinc-400">
                  (separate)
                </span>
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                Submit the roadmap page&apos;s email form → the lead upserts into
                GHL and the Four Stages PDF arrives as an email attachment.
              </p>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Gotchas */}
      <Section icon={AlertTriangle} eyebrow="Watch out" title="Gotchas">
        <Callout
          tone="amber"
          icon={AlertTriangle}
          title="Read before (and after) testing"
        >
          <ul className="space-y-2">
            <li className="flex gap-2">
              <span className="text-amber-500">•</span>
              <span>
                <strong>TEST mode only</strong> — nothing above charges real
                money.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-500">•</span>
              <span>
                <strong>Restore Settings</strong> (Minimum payout = $100, Refund
                window = 7) when done.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-500">•</span>
              <span>
                Seeded sample/demo data is excluded from payout batches — only
                your real test conversion transfers.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-500">•</span>
              <span>
                Fresh conversions sit <Mono>pending</Mono> for the 7-day refund
                window; &quot;Mark earned now&quot; is the test shortcut.
              </span>
            </li>
          </ul>
        </Callout>
      </Section>
    </div>
  );
}
