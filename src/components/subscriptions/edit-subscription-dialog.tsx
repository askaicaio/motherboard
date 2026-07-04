"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { SubscriptionRow } from "./subscriptions-page-client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: SubscriptionRow;
  onSaved?: (row: SubscriptionRow) => void;
  onCreated?: (row: SubscriptionRow) => void;
  knownDepartments?: string[];
  /** Universe of statuses pulled from the live data — drives the dropdown. */
  knownStatuses?: string[];
  /** Top-level rows the user can nest this one under (parent dropdown). */
  possibleParents?: SubscriptionRow[];
  /** Preselected parent when adding a credential from a parent's "+" action. */
  initialParentId?: string;
  /** When true the dialog renders fields as plain text (no editing). */
  readOnly?: boolean;
}

export function EditSubscriptionDialog({
  open,
  onOpenChange,
  existing,
  onSaved,
  onCreated,
  knownDepartments = [],
  knownStatuses = [],
  possibleParents = [],
  initialParentId,
  readOnly = false,
}: Props) {
  const isEdit = !!existing;
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [label, setLabel] = useState("");
  const [isStarred, setIsStarred] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [inOnePassword, setInOnePassword] = useState(false);
  const [monthlyCost, setMonthlyCost] = useState("");
  const [annualCost, setAnnualCost] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [renewalDayOfMonth, setRenewalDayOfMonth] = useState<string>("");
  // "date" = anchored to a specific calendar date; "monthly" = every Nth.
  const [renewalCadence, setRenewalCadence] = useState<"date" | "monthly">(
    "date",
  );
  const [notes, setNotes] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState("active");
  const [departments, setDepartments] = useState<string[]>([]);
  const [deptInput, setDeptInput] = useState("");
  const [parentId, setParentId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setServiceName(existing.serviceName ?? "");
      setOwnerEmail(existing.ownerEmail ?? "");
      setLabel(existing.label ?? "");
      setIsStarred(existing.isStarred);
      setWebsiteUrl(existing.websiteUrl ?? "");
      setInOnePassword(existing.inOnePassword);
      setMonthlyCost(existing.monthlyCostUsd != null ? String(existing.monthlyCostUsd) : "");
      setAnnualCost(existing.annualCostUsd != null ? String(existing.annualCostUsd) : "");
      setRenewalDate(existing.renewalDate ?? "");
      setRenewalDayOfMonth(
        existing.renewalDayOfMonth != null
          ? String(existing.renewalDayOfMonth)
          : "",
      );
      setRenewalCadence(existing.renewalDayOfMonth != null ? "monthly" : "date");
      setNotes(existing.notes ?? "");
      setTag(existing.tag ?? "");
      setStatus(existing.status);
      setDepartments(existing.departments ?? []);
      setParentId(existing.parentId ?? "");
    } else {
      setName("");
      setServiceName("");
      setOwnerEmail("");
      setLabel("");
      setIsStarred(false);
      setWebsiteUrl("");
      setInOnePassword(false);
      setMonthlyCost("");
      setAnnualCost("");
      setRenewalDate("");
      setRenewalDayOfMonth("");
      setRenewalCadence("date");
      setNotes("");
      setTag("");
      setStatus("active");
      setDepartments([]);
      setParentId(initialParentId ?? "");
    }
    setDeptInput("");
  }, [open, existing, initialParentId]);

  function addDeptFromInput() {
    const raw = deptInput.trim();
    if (!raw) return;
    const next = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !departments.includes(s));
    if (next.length === 0) {
      setDeptInput("");
      return;
    }
    setDepartments([...departments, ...next]);
    setDeptInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // A nested credential/seat doesn't need a name — it's shown by its label
    // (or owner). Derive an internal name so search + the NOT NULL column hold.
    const isChild = !!parentId;
    const finalName =
      name.trim() ||
      (isChild
        ? label.trim() || ownerEmail.trim() || serviceName.trim() || "Account"
        : "");
    if (!finalName) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const monthly = monthlyCost.trim() ? Number(monthlyCost) : null;
      let annual: number | null = annualCost.trim() ? Number(annualCost) : null;
      // Auto-derive annual if user filled monthly but not annual
      if (annual == null && monthly != null) annual = Math.round(monthly * 1200) / 100;

      const body = {
        name: finalName,
        serviceName: serviceName.trim() || null,
        ownerEmail: ownerEmail.trim() || null,
        label: label.trim() || null,
        isStarred,
        websiteUrl: websiteUrl.trim() || null,
        departments,
        inOnePassword,
        monthlyCostUsd: monthly,
        annualCostUsd: annual,
        // Cadence chooses which renewal field we send: monthly clears
        // renewal_date, date clears renewal_day_of_month. Backend treats
        // null as "not set" for both.
        renewalDate: renewalCadence === "date" ? renewalDate || null : null,
        renewalDayOfMonth:
          renewalCadence === "monthly" && renewalDayOfMonth.trim()
            ? Math.max(1, Math.min(31, Number(renewalDayOfMonth)))
            : null,
        notes: notes.trim() || null,
        parentId: parentId || null,
        tag: tag.trim() || null,
        status,
      };

      const endpoint = isEdit ? `/api/subscriptions/${existing!.id}` : "/api/subscriptions";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Save failed");
        return;
      }

      const row: SubscriptionRow = {
        id: data.subscription.id,
        externalId: data.subscription.externalId ?? null,
        name: data.subscription.name,
        serviceName: data.subscription.serviceName ?? null,
        ownerEmail: data.subscription.ownerEmail ?? null,
        label: data.subscription.label ?? null,
        isStarred: data.subscription.isStarred,
        websiteUrl: data.subscription.websiteUrl ?? null,
        departments: data.subscription.departments ?? [],
        inOnePassword: data.subscription.inOnePassword,
        parentId: data.subscription.parentId ?? null,
        monthlyCostUsd: data.subscription.monthlyCostUsd != null
          ? Number(data.subscription.monthlyCostUsd)
          : null,
        annualCostUsd: data.subscription.annualCostUsd != null
          ? Number(data.subscription.annualCostUsd)
          : null,
        renewalDate: data.subscription.renewalDate ?? null,
        renewalDayOfMonth: data.subscription.renewalDayOfMonth ?? null,
        notes: data.subscription.notes ?? null,
        tag: data.subscription.tag ?? null,
        status: data.subscription.status,
        createdAt: data.subscription.createdAt,
        updatedAt: data.subscription.updatedAt,
      };

      if (isEdit) {
        onSaved?.(row);
        toast.success("Saved");
      } else {
        onCreated?.(row);
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  // Read-only view — keeps the same dialog shape but renders as text
  if (readOnly && existing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {existing.serviceName || existing.name}
              {existing.isStarred && <span className="text-amber-500">★</span>}
            </DialogTitle>
            <DialogDescription>
              Enable Edit mode at the top of the page to make changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <Field label="Name" value={existing.name} />
            {existing.label && <Field label="Label" value={existing.label} />}
            <Field label="Owner" value={existing.ownerEmail} mono />
            {existing.websiteUrl && (
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Website</div>
                <a
                  href={existing.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline break-all"
                >
                  <ExternalLink className="h-3 w-3" />
                  {existing.websiteUrl}
                </a>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monthly" value={existing.monthlyCostUsd != null ? `$${existing.monthlyCostUsd}` : null} />
              <Field label="Annual" value={existing.annualCostUsd != null ? `$${existing.annualCostUsd}` : null} />
            </div>
            <Field
              label="Renewal"
              value={
                existing.renewalDayOfMonth != null
                  ? `Every ${existing.renewalDayOfMonth} of the month`
                  : existing.renewalDate
              }
            />
            <Field label="Status" value={existing.status} />
            <Field label="In 1Password" value={existing.inOnePassword ? "Yes" : "No"} />
            <Field label="Departments" value={existing.departments.join(", ") || null} />
            <Field label="Tag" value={existing.tag} />
            {existing.notes && (
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Notes</div>
                <div className="whitespace-pre-wrap text-sm text-zinc-700">{existing.notes}</div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit subscription" : "Add subscription"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update any field — only changed values are saved." : "Add a new SaaS / tool to the ledger."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sub-name">Name{parentId ? "" : " *"}</Label>
            <Input
              id="sub-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={300}
              placeholder={
                parentId ? "Optional for a nested account — leave blank" : ""
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sub-service">Service</Label>
              <Input id="sub-service" value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="e.g. ChatGPT" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-owner">Owner email</Label>
              <Input id="sub-owner" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="who@…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sub-url">Website URL</Label>
            <Input id="sub-url" type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://…" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sub-parent">Nest under</Label>
            <select
              id="sub-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none"
            >
              <option value="">— Top-level (no parent)</option>
              {possibleParents
                .filter((p) => !existing || p.id !== existing.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.serviceName || p.name}
                    {p.ownerEmail ? ` · ${p.ownerEmail}` : ""}
                  </option>
                ))}
            </select>
            <p className="text-[10px] text-zinc-500">
              Use this for team-plan seats (e.g. nest each Claude member account under the team-plan owner).
            </p>
          </div>

          {parentId && (
            <div className="space-y-1.5">
              <Label htmlFor="sub-label">Label</Label>
              <Input
                id="sub-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={200}
                placeholder="e.g. Editing seat"
              />
              <p className="text-[10px] text-zinc-500">
                Shown on this nested account/seat row instead of the app name.
                Leave blank if none — the owner still identifies the row.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sub-monthly">Monthly cost (USD)</Label>
              <Input
                id="sub-monthly"
                type="number"
                step="0.01"
                value={monthlyCost}
                onChange={(e) => {
                  const v = e.target.value;
                  setMonthlyCost(v);
                  // Monthly is the source of truth — recompute annual every
                  // time it changes. If the user has a discount annual plan
                  // they can override annual after.
                  if (v === "") {
                    setAnnualCost("");
                    return;
                  }
                  const n = Number(v);
                  if (Number.isFinite(n)) {
                    setAnnualCost(String(Math.round(n * 1200) / 100));
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-annual">Annual cost (USD)</Label>
              <Input id="sub-annual" type="number" step="0.01" value={annualCost} onChange={(e) => setAnnualCost(e.target.value)} />
              <p className="text-[10px] text-zinc-500">
                Auto-fills from monthly × 12. Override here for discount annual plans.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Renewal</Label>
              <div className="inline-flex rounded-md border border-zinc-300 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setRenewalCadence("date")}
                  className={
                    "rounded px-2.5 py-1 font-medium transition " +
                    (renewalCadence === "date"
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:bg-zinc-50")
                  }
                >
                  One-time date
                </button>
                <button
                  type="button"
                  onClick={() => setRenewalCadence("monthly")}
                  className={
                    "rounded px-2.5 py-1 font-medium transition " +
                    (renewalCadence === "monthly"
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:bg-zinc-50")
                  }
                >
                  Every month
                </button>
              </div>
              {renewalCadence === "date" ? (
                <Input
                  id="sub-renewal"
                  type="date"
                  value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-600">Every</span>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    step={1}
                    value={renewalDayOfMonth}
                    onChange={(e) => setRenewalDayOfMonth(e.target.value)}
                    placeholder="20"
                    className="w-20"
                  />
                  <span className="text-sm text-zinc-600">of the month</span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-status">Status</Label>
              <Input
                id="sub-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                list="known-statuses"
                placeholder="e.g. subscription, free account"
                maxLength={100}
              />
              {knownStatuses.length > 0 && (
                <datalist id="known-statuses">
                  {knownStatuses.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sub-depts">Departments</Label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-zinc-300 px-2 py-1.5 focus-within:border-zinc-400">
              {departments.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs"
                >
                  {d}
                  <button
                    type="button"
                    onClick={() => setDepartments(departments.filter((x) => x !== d))}
                    className="text-zinc-400 hover:text-zinc-700"
                    aria-label={`Remove ${d}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                id="sub-depts"
                value={deptInput}
                onChange={(e) => setDeptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addDeptFromInput();
                  } else if (e.key === "Backspace" && !deptInput && departments.length > 0) {
                    setDepartments(departments.slice(0, -1));
                  }
                }}
                onBlur={addDeptFromInput}
                list="known-depts"
                placeholder={departments.length === 0 ? "Marketing, Operations…" : ""}
                className="flex-1 min-w-[120px] bg-transparent text-sm outline-none"
              />
              <datalist id="known-depts">
                {knownDepartments.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isStarred}
                onChange={(e) => setIsStarred(e.target.checked)}
                className="rounded"
              />
              Starred (shared / primary)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={inOnePassword}
                onChange={(e) => setInOnePassword(e.target.checked)}
                className="rounded"
              />
              In 1Password
            </label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sub-tag">Tag</Label>
            <Input id="sub-tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="optional misc label" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sub-notes">Notes</Label>
            <Textarea id="sub-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Add subscription"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className={mono ? "font-mono text-sm text-zinc-800" : "text-sm text-zinc-800"}>
        {value || <span className="text-zinc-400">—</span>}
      </div>
    </div>
  );
}
