"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Settings, Save, History, Boxes, Database } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PartnerSettings {
  id: string;
  cookieWindowDays: number;
  defaultCommissionRate: string; // decimal string e.g. "0.10"
  refundWindowDays: number;
  payoutTermsDays: number;
  minPayoutCents: number;
  effectiveFrom: string;
}

export interface PartnerProgram {
  id: string;
  name: string;
  slug: string;
  listValueCents: number;
  commissionRateOverride: string | null;
  salesLed: boolean;
  active: boolean;
  stripeProductId: string | null;
  stripePriceId: string | null;
  setupFeeCents: number;
  stripeFeePassthroughCents: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtUsdCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/** Decimal rate string ("0.10") → percent number for the UI (10). */
function rateToPct(rate: string): string {
  const n = Number(rate);
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 1000) / 10);
}

/** Percent UI string ("10") → decimal rate string ("0.1"). */
function pctToRate(pct: string): string {
  const n = Number(pct);
  if (!Number.isFinite(n)) return "0";
  return String(Math.round((n / 100) * 10000) / 10000);
}

// Sensible defaults when no settings version exists yet (Net-45, 10%, etc.)
const DEFAULTS = {
  cookieWindowDays: 60,
  defaultCommissionRate: "0.10",
  refundWindowDays: 7,
  payoutTermsDays: 45,
  minPayoutCents: 10000,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SettingsClient({
  settings,
  programs,
  customersIndexCount,
}: {
  settings: PartnerSettings | null;
  programs: PartnerProgram[];
  customersIndexCount: number;
}) {
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);

  async function seedFromGhl() {
    setSeeding(true);
    try {
      const res = await fetch("/api/partners/customers-import/ghl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subaccount: "both" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "GHL pull failed");
        return;
      }
      toast.success(
        `Pulled ${data.pulledUnique ?? 0} buyers — index now ${data.customersIndexTotal ?? "?"}`,
      );
      router.refresh();
    } catch {
      toast.error("Network error during GHL pull");
    } finally {
      setSeeding(false);
    }
  }

  const base = settings ?? { ...DEFAULTS, id: "", effectiveFrom: "" };

  // Settings form state (UI uses % and $ — converted on save)
  const [cookieWindowDays, setCookieWindowDays] = useState(
    String(base.cookieWindowDays),
  );
  const [commissionPct, setCommissionPct] = useState(
    rateToPct(base.defaultCommissionRate),
  );
  const [refundWindowDays, setRefundWindowDays] = useState(
    String(base.refundWindowDays),
  );
  const [payoutTermsDays, setPayoutTermsDays] = useState(
    String(base.payoutTermsDays),
  );
  const [minPayoutDollars, setMinPayoutDollars] = useState(
    String(base.minPayoutCents / 100),
  );
  const [savingSettings, setSavingSettings] = useState(false);

  const handleSaveSettings = async () => {
    const payload = {
      cookieWindowDays: Number(cookieWindowDays),
      defaultCommissionRate: pctToRate(commissionPct),
      refundWindowDays: Number(refundWindowDays),
      payoutTermsDays: Number(payoutTermsDays),
      minPayoutCents: Math.round(Number(minPayoutDollars) * 100),
    };
    if (
      [
        payload.cookieWindowDays,
        payload.refundWindowDays,
        payload.payoutTermsDays,
        payload.minPayoutCents,
      ].some((n) => !Number.isFinite(n) || n < 0) ||
      !Number.isFinite(Number(commissionPct))
    ) {
      toast.error("Please enter valid, non-negative numbers.");
      return;
    }

    setSavingSettings(true);
    try {
      const res = await fetch("/api/partners/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save settings");
        return;
      }
      toast.success("New settings version saved");
      router.refresh();
    } catch {
      toast.error("Network error saving settings");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-zinc-500" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Partner Program Settings
          </h1>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Program-wide commission &amp; payout configuration, plus per-program
          overrides.
        </p>
      </div>

      {/* ─── New-customer gate seed (customers_index) ────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4 text-zinc-500" />
            New-customer gate
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-zinc-600">
            <span className="font-semibold tabular-nums text-zinc-900">
              {customersIndexCount.toLocaleString()}
            </span>{" "}
            prior buyers indexed. Commissions only pay on genuinely new
            customers — pull the full buyer list from GHL (both sub-accounts)
            to keep this current. Safe to re-run; it never overwrites an
            existing first-purchase date.
          </div>
          <Button onClick={seedFromGhl} disabled={seeding} variant="outline">
            {seeding ? "Pulling…" : "Pull buyers from GHL"}
          </Button>
        </CardContent>
      </Card>

      {/* ─── Effective config (append-only versions) ─────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4 text-zinc-500" />
                Effective configuration
              </CardTitle>
              <p className="mt-1 text-xs text-zinc-500">
                Saving creates a <strong>new settings version</strong>{" "}
                (append-only history) effective now — it never edits the prior
                version. Existing conversions keep the terms in force when they
                were recorded.
              </p>
            </div>
            {settings ? (
              <Badge variant="secondary" className="shrink-0 font-normal">
                In effect since{" "}
                {format(parseISO(settings.effectiveFrom), "MMM d, yyyy")}
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0 font-normal">
                No version yet — showing defaults
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              id="cookieWindowDays"
              label="Cookie window"
              suffix="days"
              hint="Attribution lookback after a referral click."
              value={cookieWindowDays}
              onChange={setCookieWindowDays}
            />
            <Field
              id="commissionPct"
              label="Default commission rate"
              suffix="%"
              hint="Applied when a program has no override."
              value={commissionPct}
              onChange={setCommissionPct}
            />
            <Field
              id="refundWindowDays"
              label="Refund window"
              suffix="days"
              hint="Hold before a sale becomes earned."
              value={refundWindowDays}
              onChange={setRefundWindowDays}
            />
            <Field
              id="payoutTermsDays"
              label="Payout terms"
              suffix="days"
              hint="Net-N from the period close."
              value={payoutTermsDays}
              onChange={setPayoutTermsDays}
            />
            <Field
              id="minPayoutDollars"
              label="Minimum payout"
              prefix="$"
              hint="Balance must clear this before payout."
              value={minPayoutDollars}
              onChange={setMinPayoutDollars}
            />
          </div>
          <div className="flex justify-end border-t pt-4">
            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              <Save className="mr-2 h-3.5 w-3.5" />
              {savingSettings ? "Saving…" : "Save new version"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Programs editor ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-zinc-500" />
            Eligible programs
          </CardTitle>
          <p className="mt-1 text-xs text-zinc-500">
            Toggle availability, set a per-program commission override (blank =
            use default), and wire up Stripe. Each row saves on its own.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2 text-left">Program</th>
                  <th className="px-3 py-2 text-right">List value</th>
                  <th className="px-3 py-2 text-center">Sales-led</th>
                  <th className="px-3 py-2 text-center">Active</th>
                  <th className="px-3 py-2 text-left">Override %</th>
                  <th className="px-3 py-2 text-left">Stripe price ID</th>
                  <th className="w-20 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {programs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-12 text-center text-sm text-zinc-500"
                    >
                      No programs configured yet.
                    </td>
                  </tr>
                ) : (
                  programs.map((p) => <ProgramRow key={p.id} program={p} />)
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Settings field ───────────────────────────────────────────────────────────

function Field({
  id,
  label,
  hint,
  prefix,
  suffix,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  prefix?: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
            {prefix}
          </span>
        )}
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(prefix && "pl-7", suffix && "pr-12")}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

// ─── Program row ──────────────────────────────────────────────────────────────

function ProgramRow({ program }: { program: PartnerProgram }) {
  const router = useRouter();
  const [active, setActive] = useState(program.active);
  const [overridePct, setOverridePct] = useState(
    program.commissionRateOverride
      ? rateToPct(program.commissionRateOverride)
      : "",
  );
  const [stripePriceId, setStripePriceId] = useState(
    program.stripePriceId ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleStripeSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(
        `/api/partners/programs/${program.id}/stripe-sync`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Stripe sync failed");
        return;
      }
      if (data.stripePriceId) setStripePriceId(data.stripePriceId);
      toast.success(
        data.alreadyWired
          ? `${program.name} already wired to Stripe`
          : `Created Stripe product + price for ${program.name}`,
      );
      router.refresh();
    } catch {
      toast.error("Network error during Stripe sync");
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    const trimmedPct = overridePct.trim();
    if (trimmedPct !== "" && !Number.isFinite(Number(trimmedPct))) {
      toast.error("Override must be a number or blank.");
      return;
    }

    const payload = {
      active,
      commissionRateOverride: trimmedPct === "" ? null : pctToRate(trimmedPct),
      stripePriceId: stripePriceId.trim() || null,
    };

    setSaving(true);
    try {
      const res = await fetch(`/api/partners/programs/${program.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save program");
        return;
      }
      toast.success(`Saved ${program.name}`);
      router.refresh();
    } catch {
      toast.error("Network error saving program");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-t align-top">
      <td className="px-3 py-3">
        <div className="font-medium text-zinc-900">{program.name}</div>
        <div className="font-mono text-[11px] text-zinc-400">{program.slug}</div>
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-zinc-700">
        {fmtUsdCents(program.listValueCents)}
      </td>
      <td className="px-3 py-3 text-center">
        {program.salesLed ? (
          <Badge variant="secondary" className="text-[10px] font-normal">
            Sales-led
          </Badge>
        ) : (
          <span className="text-zinc-300">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        <Switch checked={active} onCheckedChange={setActive} />
      </td>
      <td className="px-3 py-3">
        <div className="relative w-24">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="default"
            value={overridePct}
            onChange={(e) => setOverridePct(e.target.value)}
            className="pr-7"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
            %
          </span>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder="price_…"
            value={stripePriceId}
            onChange={(e) => setStripePriceId(e.target.value)}
            className="min-w-[150px] font-mono text-xs"
          />
          {!program.salesLed && !stripePriceId && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleStripeSync}
              disabled={syncing}
              title="Create the Stripe product + price automatically"
              className="shrink-0 whitespace-nowrap text-xs"
            >
              {syncing ? "…" : "Create in Stripe"}
            </Button>
          )}
        </div>
      </td>
      <td className="px-3 py-3 text-right">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "…" : "Save"}
        </Button>
      </td>
    </tr>
  );
}
