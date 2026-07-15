"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Settings,
  Save,
  History,
  Boxes,
  Database,
  Plus,
  Archive,
  RotateCcw,
  Sparkles,
  FileText,
} from "lucide-react";
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
  payoutDayOfMonth: number;
  effectiveFrom: string;
}

export interface PartnerProgram {
  id: string;
  name: string;
  slug: string;
  listValueCents: number;
  /** Marketing blurb shown on the /enroll cards (AI-draftable, editable). */
  description?: string | null;
  commissionRateOverride: string | null;
  salesLed: boolean;
  active: boolean;
  stripeProductId: string | null;
  stripePriceId: string | null;
  setupFeeCents: number;
  stripeFeePassthroughCents: number;
  /** Seeded "Test Product ($1)" dummy — shown with a SAMPLE ONLY badge. */
  isSample?: boolean;
  /** Soft-delete marker (ISO string) — archived programs are grouped/muted. */
  archivedAt?: string | null;
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
  payoutDayOfMonth: 1,
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
  const [creatingAll, setCreatingAll] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const activePrograms = programs.filter((p) => !p.archivedAt);
  const archivedPrograms = programs.filter((p) => !!p.archivedAt);

  // One-click: create the Stripe product + price for every self-serve program
  // that isn't wired yet. The endpoint is idempotent, so re-running is safe.
  async function createAllInStripe() {
    setCreatingAll(true);
    try {
      const targets = programs.filter(
        (p) => !p.archivedAt && !p.salesLed && !p.stripePriceId,
      );
      let ok = 0;
      let failed = 0;
      for (const p of targets) {
        try {
          const res = await fetch(
            `/api/partners/programs/${p.id}/stripe-sync`,
            { method: "POST" },
          );
          if (res.ok) ok += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }
      if (failed === 0) toast.success(`Wired ${ok} program${ok === 1 ? "" : "s"} to Stripe`);
      else toast.error(`${ok} created, ${failed} failed — check the Stripe key scopes`);
      router.refresh();
    } finally {
      setCreatingAll(false);
    }
  }

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
  const [payoutDayOfMonth, setPayoutDayOfMonth] = useState(
    String(base.payoutDayOfMonth),
  );
  const [savingSettings, setSavingSettings] = useState(false);

  const handleSaveSettings = async () => {
    const payload = {
      cookieWindowDays: Number(cookieWindowDays),
      defaultCommissionRate: pctToRate(commissionPct),
      refundWindowDays: Number(refundWindowDays),
      payoutTermsDays: Number(payoutTermsDays),
      minPayoutCents: Math.round(Number(minPayoutDollars) * 100),
      payoutDayOfMonth: Number(payoutDayOfMonth),
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
    if (
      !Number.isInteger(payload.payoutDayOfMonth) ||
      payload.payoutDayOfMonth < 1 ||
      payload.payoutDayOfMonth > 28
    ) {
      toast.error("Payout day of month must be a whole number from 1 to 28.");
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
            Affiliate Program Settings
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
            <Field
              id="payoutDayOfMonth"
              label="Payout day of month"
              hint="Day (1–28) the auto-payout batch is generated."
              value={payoutDayOfMonth}
              onChange={setPayoutDayOfMonth}
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-zinc-500" />
                Eligible programs
              </CardTitle>
              <p className="mt-1 text-xs text-zinc-500">
                Toggle availability, set a per-program commission override
                (blank = use default), and wire up Stripe. Each row saves on
                its own.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {activePrograms.some((p) => !p.salesLed && !p.stripePriceId) && (
                <Button
                  variant="outline"
                  onClick={createAllInStripe}
                  disabled={creatingAll}
                  className="whitespace-nowrap"
                >
                  {creatingAll ? "Creating…" : "Create all in Stripe"}
                </Button>
              )}
              <Button
                onClick={() => setAddOpen(true)}
                className="whitespace-nowrap"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add product
              </Button>
            </div>
          </div>
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
                  <th className="px-3 py-2 text-left">Stripe IDs</th>
                  <th className="w-28 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {activePrograms.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-12 text-center text-sm text-zinc-500"
                    >
                      No programs configured yet.
                    </td>
                  </tr>
                ) : (
                  activePrograms.map((p) => (
                    <ProgramRow key={p.id} program={p} />
                  ))
                )}

                {archivedPrograms.length > 0 && (
                  <>
                    <tr className="border-t bg-zinc-100/70">
                      <td
                        colSpan={7}
                        className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-400/90"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Archive className="h-3 w-3" />
                          Archived ({archivedPrograms.length}) — hidden from
                          affiliates
                        </span>
                      </td>
                    </tr>
                    {archivedPrograms.map((p) => (
                      <ProgramRow key={p.id} program={p} archived />
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AddProductDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

// ─── Add product dialog ─────────────────────────────────────────────────────

function AddProductDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [listValueDollars, setListValueDollars] = useState("");
  const [overridePct, setOverridePct] = useState("");
  const [salesLed, setSalesLed] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setListValueDollars("");
    setOverridePct("");
    setSalesLed(false);
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Give the program a name.");
      return;
    }
    const listVal = Number(listValueDollars);
    if (!Number.isFinite(listVal) || listVal < 0) {
      toast.error("Enter a valid list value.");
      return;
    }
    const trimmedPct = overridePct.trim();
    if (trimmedPct !== "" && !Number.isFinite(Number(trimmedPct))) {
      toast.error("Override must be a number or blank.");
      return;
    }

    const payload = {
      name: trimmedName,
      listValueCents: Math.round(listVal * 100),
      commissionRateOverride:
        trimmedPct === "" ? null : pctToRate(trimmedPct),
      salesLed,
    };

    setSaving(true);
    try {
      const res = await fetch("/api/partners/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to create program");
        return;
      }
      toast.success(`Created ${trimmedName}`);
      reset();
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Network error creating program");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add product</DialogTitle>
          <DialogDescription>
            Create a new affiliate program. Stripe wiring is done afterwards
            with the “Create in Stripe” button.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-name">Name</Label>
            <Input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Strategic Oversight"
            />
            <p className="text-xs text-zinc-400">
              A URL slug is generated automatically from the name.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-list-value">List value</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                  $
                </span>
                <Input
                  id="new-list-value"
                  type="number"
                  inputMode="decimal"
                  value={listValueDollars}
                  onChange={(e) => setListValueDollars(e.target.value)}
                  className="pl-7"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-override">Override %</Label>
              <div className="relative">
                <Input
                  id="new-override"
                  type="number"
                  inputMode="decimal"
                  value={overridePct}
                  onChange={(e) => setOverridePct(e.target.value)}
                  className="pr-7"
                  placeholder="default"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                  %
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <Label htmlFor="new-sales-led" className="cursor-pointer">
                Sales-led
              </Label>
              <p className="text-xs text-zinc-400">
                Closes via conversation — no self-serve Stripe checkout.
              </p>
            </div>
            <Switch
              id="new-sales-led"
              checked={salesLed}
              onCheckedChange={setSalesLed}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Creating…" : "Create product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function ProgramRow({
  program,
  archived = false,
}: {
  program: PartnerProgram;
  archived?: boolean;
}) {
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
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [description, setDescription] = useState(program.description ?? "");
  const [generating, setGenerating] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);

  // Ask the AI for a draft blurb — fills the box; nothing saves until "Save".
  const handleGenerateDesc = async () => {
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/partners/programs/${program.id}/generate-description`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Couldn't generate a draft");
        return;
      }
      if (data.description) setDescription(data.description);
    } catch {
      toast.error("Network error generating the draft");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDesc = async () => {
    setSavingDesc(true);
    try {
      const res = await fetch(`/api/partners/programs/${program.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save description");
        return;
      }
      toast.success(`Saved description for ${program.name}`);
      setDescOpen(false);
      router.refresh();
    } catch {
      toast.error("Network error saving the description");
    } finally {
      setSavingDesc(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const res = await fetch(`/api/partners/programs/${program.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to archive program");
        return;
      }
      toast.success(`Archived ${program.name}`);
      setConfirmArchive(false);
      router.refresh();
    } catch {
      toast.error("Network error archiving program");
    } finally {
      setArchiving(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const res = await fetch(
        `/api/partners/programs/${program.id}/restore`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to restore program");
        return;
      }
      toast.success(`Restored ${program.name}`);
      router.refresh();
    } catch {
      toast.error("Network error restoring program");
    } finally {
      setRestoring(false);
    }
  };

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
    <tr
      className={cn(
        "border-t align-top",
        archived && "bg-zinc-100/60 text-zinc-400 grayscale",
      )}
    >
      <td className={cn("px-3 py-3", archived && "opacity-60")}>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-medium",
              archived ? "text-zinc-500" : "text-zinc-900",
            )}
          >
            {program.name}
          </span>
          {program.isSample && (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-100 text-[10px] font-medium text-amber-800"
            >
              SAMPLE ONLY
            </Badge>
          )}
        </div>
        <div className="font-mono text-[11px] text-zinc-400">{program.slug}</div>
      </td>
      <td
        className={cn(
          "px-3 py-3 text-right tabular-nums",
          archived ? "text-zinc-400 opacity-60" : "text-zinc-700",
        )}
      >
        {fmtUsdCents(program.listValueCents)}
      </td>
      <td className={cn("px-3 py-3 text-center", archived && "opacity-60")}>
        {program.salesLed ? (
          <Badge variant="secondary" className="text-[10px] font-normal">
            Sales-led
          </Badge>
        ) : (
          <span className="text-zinc-300">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        {archived ? (
          <span className="text-zinc-300">—</span>
        ) : (
          <Switch checked={active} onCheckedChange={setActive} />
        )}
      </td>
      <td className="px-3 py-3">
        {archived ? (
          <span className="text-sm text-zinc-400">
            {overridePct === "" ? "default" : `${overridePct}%`}
          </span>
        ) : (
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
        )}
      </td>
      {/* Stripe IDs are READ-ONLY — managed by the Stripe sync, never hand-edited. */}
      <td className={cn("px-3 py-3", archived && "opacity-60")}>
        <div className="space-y-1">
          <div className="font-mono text-[11px] text-zinc-600">
            <span className="text-zinc-400">product</span>{" "}
            {program.stripeProductId || (
              <span className="text-zinc-300">—</span>
            )}
          </div>
          <div className="font-mono text-[11px] text-zinc-600">
            <span className="text-zinc-400">price</span>{" "}
            {stripePriceId || <span className="text-zinc-300">—</span>}
          </div>
          {!archived && !program.salesLed && !stripePriceId && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleStripeSync}
              disabled={syncing}
              title="Create the Stripe product + price automatically"
              className="mt-1 shrink-0 whitespace-nowrap text-xs"
            >
              {syncing ? "…" : "Create in Stripe"}
            </Button>
          )}
          <p className="text-[10px] text-zinc-400">
            Managed automatically by Stripe sync.
          </p>
        </div>
      </td>
      <td className="px-3 py-3 text-right">
        {archived ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestore}
            disabled={restoring}
            className="whitespace-nowrap opacity-100 grayscale-0"
          >
            <RotateCcw className="mr-1.5 h-3 w-3" />
            {restoring ? "…" : "Restore"}
          </Button>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDescOpen(true)}
              title="Edit the checkout description (AI can draft it)"
              className={cn(
                "whitespace-nowrap",
                program.description
                  ? "text-indigo-600 hover:text-indigo-700"
                  : "text-zinc-500 hover:text-indigo-600",
              )}
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              {program.description ? "Sales copy" : "Add copy"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "…" : "Save"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmArchive(true)}
              title="Archive program"
              className="text-zinc-500 hover:text-red-600"
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <Dialog
          open={descOpen}
          onOpenChange={(o) => {
            setDescOpen(o);
            // Re-seed from the persisted value on open so abandoned edits or
            // rejected AI drafts are discarded (state is seeded once at mount).
            if (o) setDescription(program.description ?? "");
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Checkout description — {program.name}</DialogTitle>
              <DialogDescription>
                Shown on the <span className="font-mono">/enroll</span> card for
                this product. Draft it with AI, edit freely, then save. Nothing
                goes live until you click Save.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-1 text-left">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="e.g. A hands-on program that takes leaders from AI-curious to running real workflows in 90 days."
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleGenerateDesc}
                disabled={generating}
                className="gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {generating ? "Generating…" : "Generate with AI"}
              </Button>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDescOpen(false)}
                disabled={savingDesc}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveDesc} disabled={savingDesc}>
                {savingDesc ? "Saving…" : "Save description"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmArchive} onOpenChange={setConfirmArchive}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Archive {program.name}?</DialogTitle>
              <DialogDescription>
                It will be hidden from affiliates. You can restore it anytime.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmArchive(false)}
                disabled={archiving}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleArchive}
                disabled={archiving}
              >
                {archiving ? "Archiving…" : "Archive"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </td>
    </tr>
  );
}
