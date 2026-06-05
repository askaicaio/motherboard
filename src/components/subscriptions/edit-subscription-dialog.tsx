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
  readOnly = false,
}: Props) {
  const isEdit = !!existing;
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [isStarred, setIsStarred] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [inOnePassword, setInOnePassword] = useState(false);
  const [monthlyCost, setMonthlyCost] = useState("");
  const [annualCost, setAnnualCost] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [notes, setNotes] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState("active");
  const [departments, setDepartments] = useState<string[]>([]);
  const [deptInput, setDeptInput] = useState("");

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setServiceName(existing.serviceName ?? "");
      setOwnerEmail(existing.ownerEmail ?? "");
      setIsStarred(existing.isStarred);
      setWebsiteUrl(existing.websiteUrl ?? "");
      setInOnePassword(existing.inOnePassword);
      setMonthlyCost(existing.monthlyCostUsd != null ? String(existing.monthlyCostUsd) : "");
      setAnnualCost(existing.annualCostUsd != null ? String(existing.annualCostUsd) : "");
      setRenewalDate(existing.renewalDate ?? "");
      setNotes(existing.notes ?? "");
      setTag(existing.tag ?? "");
      setStatus(existing.status);
      setDepartments(existing.departments ?? []);
    } else {
      setName("");
      setServiceName("");
      setOwnerEmail("");
      setIsStarred(false);
      setWebsiteUrl("");
      setInOnePassword(false);
      setMonthlyCost("");
      setAnnualCost("");
      setRenewalDate("");
      setNotes("");
      setTag("");
      setStatus("active");
      setDepartments([]);
    }
    setDeptInput("");
  }, [open, existing]);

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
    if (!name.trim()) {
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
        name: name.trim(),
        serviceName: serviceName.trim() || null,
        ownerEmail: ownerEmail.trim() || null,
        isStarred,
        websiteUrl: websiteUrl.trim() || null,
        departments,
        inOnePassword,
        monthlyCostUsd: monthly,
        annualCostUsd: annual,
        renewalDate: renewalDate || null,
        notes: notes.trim() || null,
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
        isStarred: data.subscription.isStarred,
        websiteUrl: data.subscription.websiteUrl ?? null,
        departments: data.subscription.departments ?? [],
        inOnePassword: data.subscription.inOnePassword,
        monthlyCostUsd: data.subscription.monthlyCostUsd != null
          ? Number(data.subscription.monthlyCostUsd)
          : null,
        annualCostUsd: data.subscription.annualCostUsd != null
          ? Number(data.subscription.annualCostUsd)
          : null,
        renewalDate: data.subscription.renewalDate ?? null,
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
            <Field label="Renewal date" value={existing.renewalDate} />
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
            <Label htmlFor="sub-name">Name *</Label>
            <Input id="sub-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={300} />
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sub-monthly">Monthly cost (USD)</Label>
              <Input
                id="sub-monthly"
                type="number"
                step="0.01"
                value={monthlyCost}
                onChange={(e) => {
                  setMonthlyCost(e.target.value);
                  // Auto-derive annual on the fly
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && !annualCost) {
                    setAnnualCost(String(Math.round(n * 1200) / 100));
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-annual">Annual cost (USD)</Label>
              <Input id="sub-annual" type="number" step="0.01" value={annualCost} onChange={(e) => setAnnualCost(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sub-renewal">Renewal date</Label>
              <Input id="sub-renewal" type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />
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
