"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Plus, Search, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface PartnerRow {
  id: string;
  refCode: string;
  name: string;
  email: string;
  company: string | null;
  status: string;
  taxFormStatus: string;
  payoutMethod: string;
  payoutDetails: string | null;
  ghlContactId: string | null;
  notes: string | null;
  appliedAt: string | null;
  approvedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  createdAt: string;
  updatedAt: string;
}

const TAX_FORM_OPTIONS = ["none", "w9", "w8ben", "w8bene", "invalid"] as const;
const PAYOUT_OPTIONS = ["none", "ach", "zelle"] as const;

const TAX_FORM_LABELS: Record<string, string> = {
  none: "None",
  w9: "W-9",
  w8ben: "W-8BEN",
  w8bene: "W-8BEN-E",
  invalid: "Invalid",
};
const PAYOUT_LABELS: Record<string, string> = {
  none: "None",
  ach: "ACH",
  zelle: "Zelle",
};

// Status palette: active/approved=emerald, applied=amber,
// declined/terminated/suspended=zinc/red.
function statusTone(status: string): string {
  switch (status) {
    case "active":
    case "approved":
      return "bg-emerald-100 text-emerald-700";
    case "applied":
      return "bg-amber-100 text-amber-700";
    case "suspended":
    case "terminated":
      return "bg-red-100 text-red-700";
    case "declined":
      return "bg-zinc-200 text-zinc-600";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
        statusTone(status),
      )}
    >
      {status}
    </span>
  );
}

function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(link).then(
          () => {
            setCopied(true);
            toast.success("Referral link copied");
            setTimeout(() => setCopied(false), 1500);
          },
          () => toast.error("Failed to copy"),
        );
      }}
      className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
      title={link}
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      <span className="font-mono max-w-[180px] truncate">{link}</span>
    </button>
  );
}

export function PartnersClient({
  initialPartners,
  baseUrl,
}: {
  initialPartners: PartnerRow[];
  baseUrl: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialPartners);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PartnerRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const refLink = (refCode: string) => `${baseUrl}/r?aff=${refCode}`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.email, r.company, r.refCode, r.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  const handleUpdated = (updated: PartnerRow) => {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelected((s) => (s && s.id === updated.id ? updated : s));
  };
  const handleCreated = (created: PartnerRow) => {
    setRows((prev) => [created, ...prev]);
    toast.success(`Added ${created.name}`);
    router.refresh();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">Affiliates</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Manage your affiliates — review applications, approve, and track
            payout readiness.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-3.5 w-3.5" />
          New affiliate
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search name, email, company, code…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-zinc-500">
            No affiliates match your search.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tax form</TableHead>
                  <TableHead>Payout</TableHead>
                  <TableHead>Referral link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="font-mono text-xs text-zinc-600">
                      {r.email}
                    </TableCell>
                    <TableCell className="text-zinc-600">
                      {r.company || <span className="text-zinc-400">—</span>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-xs text-zinc-600">
                      {TAX_FORM_LABELS[r.taxFormStatus] ?? r.taxFormStatus}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-600">
                      {PAYOUT_LABELS[r.payoutMethod] ?? r.payoutMethod}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {r.refCode ? (
                        <CopyLinkButton link={refLink(r.refCode)} />
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <PartnerDetailDialog
        partner={selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onUpdated={handleUpdated}
        refLink={refLink}
        router={router}
      />
      <NewPartnerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}

// ─── Detail + Edit dialog ──────────────────────────────────────────────────

function PartnerDetailDialog({
  partner,
  onOpenChange,
  onUpdated,
  refLink,
  router,
}: {
  partner: PartnerRow | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: (p: PartnerRow) => void;
  refLink: (refCode: string) => string;
  router: ReturnType<typeof useRouter>;
}) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [taxFormStatus, setTaxFormStatus] = useState<string>("none");
  const [payoutMethod, setPayoutMethod] = useState<string>("none");
  const [payoutDetails, setPayoutDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  // Track which partner the form is currently synced to so we re-seed
  // the controlled inputs whenever a different row is opened.
  const [syncedId, setSyncedId] = useState<string | null>(null);

  if (partner && partner.id !== syncedId) {
    setSyncedId(partner.id);
    setName(partner.name);
    setCompany(partner.company || "");
    setTaxFormStatus(partner.taxFormStatus);
    setPayoutMethod(partner.payoutMethod);
    setPayoutDetails(partner.payoutDetails || "");
    setNotes(partner.notes || "");
    setDeclineReason("");
  }

  const open = !!partner;

  const handleSave = async () => {
    if (!partner) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/partners/${partner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          company,
          taxFormStatus,
          payoutMethod,
          payoutDetails,
          notes,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to save");
        return;
      }
      const { partner: updated } = await res.json();
      onUpdated(updated);
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!partner) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/partners/${partner.id}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Failed to approve");
        return;
      }
      const { partner: updated } = await res.json();
      onUpdated(updated);
      toast.success("Approved — welcome email sent");
      router.refresh();
    } catch {
      toast.error("Failed to approve");
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!partner) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/partners/${partner.id}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason }),
      });
      if (!res.ok) {
        toast.error("Failed to decline");
        return;
      }
      const { partner: updated } = await res.json();
      onUpdated(updated);
      toast.success("Application declined");
      router.refresh();
    } catch {
      toast.error("Failed to decline");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {partner?.name}
            {partner && <StatusBadge status={partner.status} />}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {partner?.email}
          </DialogDescription>
        </DialogHeader>

        {partner && (
          <div className="space-y-4">
            {/* Read-only facts */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Fact label="Ref code" value={partner.refCode || "—"} mono />
              <Fact
                label="Applied"
                value={fmtDate(partner.appliedAt)}
              />
              <Fact label="Approved" value={fmtDate(partner.approvedAt)} />
              <Fact label="Declined" value={fmtDate(partner.declinedAt)} />
            </div>

            {partner.refCode && (
              <div>
                <Label className="text-xs text-zinc-500">Referral link</Label>
                <div className="mt-1">
                  <CopyLinkButton link={refLink(partner.refCode)} />
                </div>
              </div>
            )}

            {/* Applied: approve / decline */}
            {partner.status === "applied" && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
                <div className="text-xs font-medium text-amber-800">
                  This application is pending review.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    disabled={busy}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDecline}
                    disabled={busy}
                  >
                    Decline
                  </Button>
                </div>
                <Input
                  placeholder="Decline reason (optional)"
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  className="text-xs"
                />
              </div>
            )}

            {partner.declineReason && (
              <Fact label="Decline reason" value={partner.declineReason} />
            )}

            {/* Edit form */}
            <div className="space-y-3 border-t pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Name</Label>
                <Input
                  id="p-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-company">Company</Label>
                <Input
                  id="p-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tax form</Label>
                  <Select
                    value={taxFormStatus}
                    onValueChange={(v) => setTaxFormStatus(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_FORM_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {TAX_FORM_LABELS[o]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Payout method</Label>
                  <Select value={payoutMethod} onValueChange={(v) => setPayoutMethod(v ?? "")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYOUT_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {PAYOUT_LABELS[o]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-payout">Payout details</Label>
                <Textarea
                  id="p-payout"
                  value={payoutDetails}
                  onChange={(e) => setPayoutDetails(e.target.value)}
                  placeholder="Bank routing notes, Zelle handle, etc."
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-notes">Notes</Label>
                <Textarea
                  id="p-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Close
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Fact({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className={cn("mt-0.5 text-sm text-zinc-800", mono && "font-mono")}>
        {value}
      </div>
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

// ─── New partner dialog ────────────────────────────────────────────────────

function NewPartnerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (p: PartnerRow) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setEmail("");
    setCompany("");
  };

  const handleCreate = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim() || null,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to create affiliate");
        return;
      }
      const { partner } = await res.json();
      onCreated(partner);
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Failed to create partner");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New affiliate</DialogTitle>
          <DialogDescription>
            Manually add an affiliate. They&apos;ll start in the
            &ldquo;applied&rdquo; state.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="np-name">Name</Label>
            <Input
              id="np-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-email">Email</Label>
            <Input
              id="np-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-company">Company (optional)</Label>
            <Input
              id="np-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
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
            {saving ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
