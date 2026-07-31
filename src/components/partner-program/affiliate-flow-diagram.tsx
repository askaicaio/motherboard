// Quick visual map of the affiliate journey, shown at the top of the testing
// guide. A timeline of stages; the referral step branches into its three
// channels, all converging on Motherboard. Nodes that map to a real surface are
// clickable (internal → the admin page; external → the public affiliate site).
import NextLink from "next/link";
import {
  Megaphone,
  UserPlus,
  Mail,
  CheckCircle2,
  LogIn,
  Wallet,
  Share2,
  CalendarClock,
  CreditCard,
  ClipboardList,
  ArrowRight,
} from "lucide-react";

const AFF = "https://affiliates.chiefaiofficer.com";

const TONES: Record<string, string> = {
  zinc: "border-zinc-200 bg-white text-zinc-700",
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
};

function Pill({
  icon: Icon,
  children,
  tone = "zinc",
  href,
}: {
  icon?: typeof Mail;
  children: React.ReactNode;
  tone?: "zinc" | "indigo" | "emerald" | "amber";
  /** If set, the pill becomes a link (http… opens the public site in a new tab). */
  href?: string;
}) {
  const base = `inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium ${TONES[tone]}`;
  const interactive =
    " transition hover:-translate-y-px hover:shadow-sm hover:ring-2 hover:ring-indigo-200 cursor-pointer";
  const inner = (
    <>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </>
  );
  if (!href) return <span className={base}>{inner}</span>;
  if (href.startsWith("http")) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={base + interactive}
        title="Opens the public affiliate site"
      >
        {inner}
      </a>
    );
  }
  return (
    <NextLink href={href} className={base + interactive}>
      {inner}
    </NextLink>
  );
}

function Arrow() {
  return <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300" />;
}

function Stage({
  n,
  last,
  children,
}: {
  n: number;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
          {n}
        </span>
        {!last && <span className="w-px flex-1 bg-zinc-200" />}
      </div>
      <div className={`min-w-0 flex-1 ${last ? "" : "pb-4"}`}>{children}</div>
    </div>
  );
}

export function AffiliateFlowDiagram() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-5">
      <div className="mb-1 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-indigo-600" />
        <h2 className="text-sm font-semibold text-zinc-900">
          The affiliate journey — quick map
        </h2>
      </div>
      <p className="mb-4 pl-6 text-xs text-zinc-400">
        Nodes with a link are clickable — jump straight to that page.
      </p>

      <div>
        <Stage n={1}>
          <div className="flex flex-wrap items-center gap-2">
            <Pill icon={Megaphone} href={`${AFF}/partners`}>
              Landing page
            </Pill>
            <Arrow />
            <Pill icon={UserPlus} href={`${AFF}/partners/apply`}>
              Affiliate applies
            </Pill>
            <Arrow />
            <Pill icon={Mail} tone="indigo" href="/partner-program/emails">
              Confirmation email
            </Pill>
          </div>
        </Stage>

        <Stage n={2}>
          <div className="flex flex-wrap items-center gap-2">
            <Pill
              icon={CheckCircle2}
              tone="emerald"
              href="/partner-program/applications"
            >
              CAIO reviews &amp; approves
            </Pill>
            <Arrow />
            <Pill icon={Mail} tone="indigo" href="/partner-program/emails">
              Approval email
            </Pill>
            <span className="text-xs text-zinc-400">
              (or decline → waitlist)
            </span>
          </div>
        </Stage>

        <Stage n={3}>
          <div className="flex flex-wrap items-center gap-2">
            <Pill icon={LogIn} href={`${AFF}/portal`}>
              Signs in to portal
            </Pill>
            <Arrow />
            <Pill icon={Wallet} tone="amber" href={`${AFF}/portal/payouts`}>
              Sets up payout · Stripe Connect
            </Pill>
          </div>
        </Stage>

        <Stage n={4}>
          <div className="space-y-2">
            <Pill icon={Share2} tone="indigo" href="/partner-program/partners">
              Shares referral link — drives one of:
            </Pill>
            <div className="space-y-1.5 border-l-2 border-zinc-200 pl-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pill icon={CalendarClock}>Book a call</Pill>
                <Arrow />
                <Pill>GHL</Pill>
                <Arrow />
                <Pill>Meeting</Pill>
                <Arrow />
                <Pill tone="emerald">Deal</Pill>
                <span className="text-xs text-zinc-400">/</span>
                <Pill tone="zinc">No deal</Pill>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Pill icon={CreditCard} href={`${AFF}/enroll`}>
                  Buy now (/enroll)
                </Pill>
                <Arrow />
                <Pill>Stripe</Pill>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Pill icon={ClipboardList} href="https://assessment.chiefaiofficer.com">
                  Assessment
                </Pill>
                <Arrow />
                <Pill>MailerLite</Pill>
                <Arrow />
                <Pill>GHL</Pill>
              </div>
            </div>
          </div>
        </Stage>

        <Stage n={5} last>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">
              Every path reports back to
            </span>
            <NextLink
              href="/partner-program/events"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs font-semibold text-white transition hover:bg-zinc-700"
            >
              Motherboard
            </NextLink>
            <span className="text-xs text-zinc-500">
              — attribution, conversion &amp; payout are recorded here.
            </span>
          </div>
        </Stage>
      </div>
    </div>
  );
}
