// Partner Program — TEAM-ONLY affiliate testing guide (server component).
//
// Privacy is belt-and-suspenders:
//   1) requireAuth() gates the whole route to signed-in staff, so it's already
//      private (not reachable by the public or by affiliates).
//   2) We still export metadata with robots noindex/nofollow so that — in the
//      unlikely event a URL leaks — Google won't index or follow it.
//
// This is a static walkthrough (no DB reads). It is written for non-technical
// teammates: it describes what an affiliate (and what we, the admins) actually
// SEE at each step, in plain English. The payment side runs in Stripe's test
// mode ("practice mode"), so real cards are never charged.

import { requireAuth } from "@/lib/auth/guard";
import {
  FlaskConical,
  ShieldCheck,
  ListChecks,
  UserRound,
  CreditCard,
  Workflow,
  AlertTriangle,
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

// Where the public affiliate-facing pages live. Hard-coded to the production
// affiliate domain so every link here works no matter where you open the guide.
const AFF = "https://affiliates.chiefaiofficer.com";

// ── Small presentational helpers ─────────────────────────────────────────────

/** Inline monospace token for literal values a tester types or reads
 *  (referral codes, the test card number, dollar amounts). */
function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[12px] text-zinc-800">
      {children}
    </code>
  );
}

/** A clickable link. Internal app pages open in place; anything starting with
 *  http opens in a new tab. Always visibly underlined so it's obviously a link. */
function GuideLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const cls =
    "font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 transition hover:text-indigo-700 hover:decoration-indigo-500";
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <NextLink href={href} className={cls}>
      {children}
    </NextLink>
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

/** "What you should see" line — the confirmation for a step. */
function SeeThis({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 flex gap-1.5 text-sm text-emerald-700">
      <span aria-hidden className="mt-px">
        ✓
      </span>
      <span>
        <span className="font-medium">You should see:</span> {children}
      </span>
    </p>
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
  icon: typeof ShieldCheck;
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
              A plain-English walkthrough of everything an affiliate — and you,
              the admin — will experience, from applying all the way to getting
              paid. The payment side runs in a safe{" "}
              <strong className="font-semibold text-zinc-700">
                practice mode
              </strong>{" "}
              (test mode), so real cards are never charged and no real money is
              paid out.
            </p>
          </div>
        </div>

        {/* Demo login */}
        <Card className="border-zinc-200">
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Demo affiliate login
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Mono>demo@chiefaiofficer.com</Mono>
                <span className="text-zinc-300">/</span>
                <Mono>CaioDemo2026!</Mono>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-zinc-500">
              Use this whenever a step says &quot;sign in as the demo
              affiliate&quot; — mostly in Part&nbsp;2. In Part&nbsp;1 you can
              instead approve a brand-new applicant to see the full flow.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Before you start */}
      <Section
        icon={ListChecks}
        eyebrow="Before you start"
        title="The short version"
        desc="You don't need to set anything up. Here's all you need to know."
      >
        <Callout tone="sky" icon={ShieldCheck} title="Three things to know">
          <ul className="space-y-2.5">
            <li className="flex gap-2">
              <span className="text-sky-400">1.</span>
              <span>
                <strong>Everything is already connected.</strong> You don&apos;t
                have to configure anything — just follow the steps.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-sky-400">2.</span>
              <span>
                You&apos;ll use the <strong>demo affiliate login</strong> above,
                plus a <strong>practice card number</strong> we give you in
                Part&nbsp;2 (no real card needed).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-sky-400">3.</span>
              <span>
                It&apos;s all <strong>practice mode</strong> — our payment system
                is running in test mode, so nothing charges a real card or sends
                real money to anyone.
              </span>
            </li>
          </ul>
        </Callout>
      </Section>

      {/* Part 1 */}
      <Section
        icon={UserRound}
        eyebrow="Part 1"
        title="What a new affiliate experiences"
        desc="Apply → get approved → sign in → look around the portal."
      >
        <Card>
          <CardContent className="p-5">
            <ol className="space-y-5">
              <Step n={1} title="They apply">
                Open the{" "}
                <GuideLink href={`${AFF}/partners/apply`}>
                  affiliate application form
                </GuideLink>{" "}
                (this is exactly what a potential affiliate sees), fill it in,
                attach any PDF where it asks for a tax form, and submit.
                <SeeThis>
                  a friendly &quot;Thanks for applying&quot; page. The applicant
                  gets a confirmation email, and{" "}
                  <Mono>partners@chiefaiofficer.com</Mono> gets a heads-up that
                  someone applied.
                </SeeThis>
              </Step>

              <Step n={2} title="You approve them">
                In Motherboard (this admin site you&apos;re on right now), open{" "}
                <GuideLink href="/partner-program/applications">
                  Affiliate Program → Applications
                </GuideLink>
                , find the applicant, and click <strong>Approve</strong>. (The{" "}
                <strong>Tax form</strong> button on their application opens the
                PDF they uploaded, so you can check it.)
                <SeeThis>
                  they flip to <strong>Active</strong> and automatically get a
                  welcome email with a <strong>temporary password</strong>.
                </SeeThis>
              </Step>

              <Step n={3} title="They sign in">
                They go to the{" "}
                <GuideLink href={`${AFF}/portal/login`}>
                  affiliate portal sign-in
                </GuideLink>{" "}
                and log in with that temporary password.
                <SeeThis>
                  they&apos;re asked to choose their own password, and then land
                  on their dashboard — with their personal referral link and
                  their earnings so far.
                </SeeThis>
              </Step>

              <Step n={4} title="They look around">
                In the portal they can copy their referral link, open the{" "}
                <strong>Resources</strong> and <strong>Toolkit</strong> pages
                (marketing materials), and raise a question about a sale on the{" "}
                <strong>Disputes</strong> page. Have a click through it the way a
                real affiliate would.
              </Step>

              <Step n={5} title="You can preview their portal (&quot;View as&quot;)">
                From{" "}
                <GuideLink href="/partner-program/partners">
                  Affiliate Program → Partners
                </GuideLink>
                , click <strong>&quot;View as&quot;</strong> next to any active
                affiliate.
                <SeeThis>
                  their portal, exactly as they see it — you can look but not
                  change anything — with an{" "}
                  <strong>&quot;Admin preview&quot;</strong> banner across the
                  top so you never mistake it for your own account.
                </SeeThis>
              </Step>
            </ol>
          </CardContent>
        </Card>
      </Section>

      {/* Part 2 */}
      <Section
        icon={CreditCard}
        eyebrow="Part 2 · the important one"
        title="The money journey"
        desc="Someone clicks a referral link → buys → the affiliate gets credited → you pay them out."
      >
        <Callout tone="sky" icon={ShieldCheck} title="Quick setup for the test">
          Two one-time tweaks so you can see a payout happen in minutes instead
          of waiting:
          <ul className="mt-2 space-y-1.5">
            <li className="flex gap-2">
              <span className="text-sky-400">•</span>
              <span>
                In{" "}
                <GuideLink href="/partner-program/settings">
                  Affiliate Program → Settings
                </GuideLink>
                , set the <strong>minimum payout to $0</strong> for now (put it
                back to $100 when you&apos;re done).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-sky-400">•</span>
              <span>
                Sign in as the demo affiliate (the login at the top of this
                page), go to <strong>Payouts</strong>, and click{" "}
                <strong>&quot;Connect payout account&quot;</strong>. This opens
                Stripe — our payment system — and its test-mode setup form; use
                the test-data shortcuts to fill it in quickly. When you come
                back, the card reads{" "}
                <strong>&quot;Connected — your payouts are sent
                automatically.&quot;</strong>
              </span>
            </li>
          </ul>
        </Callout>

        <Card>
          <CardContent className="p-5">
            <ol className="space-y-5">
              <Step n={1} title="Click a referral link">
                Click this example referral link (no need to type anything —
                just click):{" "}
                <GuideLink href={`${AFF}/r?aff=DEMO2026`}>
                  {`${AFF}/r?aff=DEMO2026`}
                </GuideLink>
                . It&apos;s the demo affiliate&apos;s personal link (their code
                is <Mono>DEMO2026</Mono>).
                <SeeThis>
                  it takes you to our book-a-call page and quietly remembers
                  that this visit came from the demo affiliate.
                </SeeThis>
              </Step>

              <Step n={2} title="Buy something">
                A referral link normally points people to book a call. To test an
                actual purchase, open our{" "}
                <GuideLink href={`${AFF}/enroll`}>checkout page</GuideLink>{" "}
                directly and confirm the referral box already shows{" "}
                <Mono>DEMO2026</Mono> (it&apos;s remembered from the link you
                clicked). Click <strong>&quot;Buy now&quot;</strong> on the $1
                test program and pay with the practice card:
                <div className="mt-2 flex flex-wrap gap-2">
                  <Mono>4242 4242 4242 4242</Mono>
                  <Mono>Exp 12/34</Mono>
                  <Mono>CVC (3-digit code) 123</Mono>
                  <Mono>ZIP: any, e.g. 10001</Mono>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-amber-700">
                  Heads up: the $1 test program only shows here once a test price
                  is attached to it in Stripe. If you don&apos;t see it yet, ask
                  an admin to wire that up — in the meantime, in practice mode
                  you can safely &quot;Buy now&quot; on any program (nothing is
                  charged).
                </p>
              </Step>

              <Step n={3} title="See the sale credited to the affiliate">
                Back in Motherboard, open{" "}
                <GuideLink href="/partner-program/events">
                  Affiliate Program → Events
                </GuideLink>
                .
                <SeeThis>
                  the sale appears in the activity list, credited to the Demo
                  Affiliate, with a commission of <strong>10% of the price</strong>{" "}
                  (so <Mono>$0.10</Mono> on the $1 test program). It starts as{" "}
                  <strong>Pending</strong>.
                </SeeThis>
              </Step>

              <Step n={4} title="Skip the waiting period (test shortcut)">
                Every real sale sits as <strong>Pending</strong> for a few days
                first — that&apos;s the refund window, so we never pay out on a
                sale that later gets refunded. To test without waiting, click the{" "}
                <strong>three-dots (…) button</strong> on that sale&apos;s row and
                choose <strong>&quot;Mark earned now&quot;</strong>.
                <SeeThis>
                  it moves from <strong>Pending</strong> to{" "}
                  <strong>Earned</strong> (ready to be paid).
                </SeeThis>
              </Step>

              <Step n={5} title="Put the payout together">
                Still in the admin, open the <strong>Payouts</strong> tab (it sits
                next to Activity, inside{" "}
                <GuideLink href="/partner-program/events">Events</GuideLink>) and
                click <strong>&quot;Generate payout batch&quot;</strong> — that
                just gathers up everyone who&apos;s owed money right now.
                <SeeThis>
                  a draft payout appears containing the <Mono>$0.10</Mono> owed to
                  the demo affiliate.
                </SeeThis>
              </Step>

              <Step n={6} title="Mark it paid">
                On that payout, click <strong>&quot;Mark paid&quot;</strong>.
                <SeeThis>
                  the sale flips to <strong>Paid</strong> in Events — the
                  affiliate is now recorded as paid.
                </SeeThis>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
                  The actual bank transfer to the affiliate&apos;s connected
                  account is sent automatically on our scheduled monthly payout
                  run (that&apos;s when a matching transfer would show up in
                  Stripe). The buttons above are how you track and settle payouts
                  in the meantime.
                </p>
              </Step>

              <Step n={7} title="Put the setting back">
                Return to{" "}
                <GuideLink href="/partner-program/settings">Settings</GuideLink>{" "}
                and set the <strong>minimum payout back to $100</strong>.
              </Step>
            </ol>
          </CardContent>
        </Card>
      </Section>

      {/* Part 3 */}
      <Section
        icon={Workflow}
        eyebrow="Part 3"
        title="Behind the scenes: it updates GoHighLevel too"
        desc="Nothing to click — this happens on its own. Here's what to look for."
      >
        <Card>
          <CardContent className="space-y-4 p-5">
            <p className="text-sm leading-relaxed text-zinc-600">
              GoHighLevel is the tool we use to keep track of our contacts and
              leads. You don&apos;t need to open it to run this test — this
              section just explains what happens there automatically.
            </p>
            <div className="border-t border-zinc-100 pt-4">
              <p className="text-sm font-medium text-zinc-900">
                New affiliates become contacts
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                On the next daily sync (it runs once a day), a newly approved
                affiliate shows up as a contact in our affiliate GoHighLevel
                account, tagged <Mono>affiliate-partner</Mono>. So they may not
                appear the instant you approve them — allow up to a day.
              </p>
            </div>
            <div className="border-t border-zinc-100 pt-4">
              <p className="text-sm font-medium text-zinc-900">
                Buyers get tagged as referrals
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                After a referred sale, the <strong>buyer&apos;s</strong> contact
                in GoHighLevel gets tagged <Mono>affiliate-referral</Mono>, with
                a note saying which affiliate sent them.
              </p>
            </div>
            <div className="border-t border-zinc-100 pt-4">
              <p className="text-sm font-medium text-zinc-900">
                Roadmap page leads{" "}
                <span className="text-xs font-normal text-zinc-400">
                  (a separate flow)
                </span>
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                Fill in the email form on the{" "}
                <GuideLink href="https://roadmap.chiefaiofficer.com">
                  roadmap landing page
                </GuideLink>
                . The lead is added to GoHighLevel and the Four Stages PDF
                arrives in that inbox as an email attachment.
              </p>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Tips */}
      <Section icon={AlertTriangle} eyebrow="Good to know" title="A few tips">
        <Callout tone="amber" icon={AlertTriangle} title="Keep these in mind">
          <ul className="space-y-2">
            <li className="flex gap-2">
              <span className="text-amber-500">•</span>
              <span>
                <strong>It&apos;s all practice mode.</strong> Our payment system
                is in test mode, so nothing above charges a real card or moves
                real money.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-500">•</span>
              <span>
                <strong>Reset your settings</strong> when you finish — minimum
                payout back to <strong>$100</strong>.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-500">•</span>
              <span>
                The <strong>sample/demo</strong> rows you may see in the lists
                are just examples — they&apos;re never included when you pay
                affiliates. Only your own test sale counts.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-500">•</span>
              <span>
                A brand-new sale won&apos;t be payable right away — it waits out
                the refund window first. <strong>&quot;Mark earned now&quot;</strong>{" "}
                is the shortcut for testing only.
              </span>
            </li>
          </ul>
        </Callout>
      </Section>
    </div>
  );
}
