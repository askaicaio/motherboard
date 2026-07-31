// Quick visual map of the affiliate journey, shown at the top of the testing
// guide. Presentational only (no state) — a timeline of stages, with the
// referral step branching into its three channels, all converging on
// Motherboard. Mirrors the hand-drawn flow.
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

function Pill({
  icon: Icon,
  children,
  tone = "zinc",
}: {
  icon?: typeof Mail;
  children: React.ReactNode;
  tone?: "zinc" | "indigo" | "emerald" | "amber";
}) {
  const tones: Record<string, string> = {
    zinc: "border-zinc-200 bg-white text-zinc-700",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </span>
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
      {/* Rail */}
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
      <div className="mb-4 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-indigo-600" />
        <h2 className="text-sm font-semibold text-zinc-900">
          The affiliate journey — quick map
        </h2>
      </div>

      <div>
        <Stage n={1}>
          <div className="flex flex-wrap items-center gap-2">
            <Pill icon={Megaphone}>Landing page</Pill>
            <Arrow />
            <Pill icon={UserPlus}>Affiliate applies</Pill>
            <Arrow />
            <Pill icon={Mail} tone="indigo">
              Confirmation email
            </Pill>
          </div>
        </Stage>

        <Stage n={2}>
          <div className="flex flex-wrap items-center gap-2">
            <Pill icon={CheckCircle2} tone="emerald">
              CAIO reviews &amp; approves
            </Pill>
            <Arrow />
            <Pill icon={Mail} tone="indigo">
              Approval email
            </Pill>
            <span className="text-xs text-zinc-400">
              (or decline → waitlist)
            </span>
          </div>
        </Stage>

        <Stage n={3}>
          <div className="flex flex-wrap items-center gap-2">
            <Pill icon={LogIn}>Signs in to portal</Pill>
            <Arrow />
            <Pill icon={Wallet} tone="amber">
              Sets up payout · Stripe Connect
            </Pill>
          </div>
        </Stage>

        <Stage n={4}>
          <div className="space-y-2">
            <Pill icon={Share2} tone="indigo">
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
                <Pill icon={CreditCard}>Buy now (/enroll)</Pill>
                <Arrow />
                <Pill>Stripe</Pill>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Pill icon={ClipboardList}>Assessment</Pill>
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
            <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs font-semibold text-white">
              Motherboard
            </span>
            <span className="text-xs text-zinc-500">
              — attribution, conversion &amp; payout are recorded here.
            </span>
          </div>
        </Stage>
      </div>
    </div>
  );
}
