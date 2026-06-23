"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { GitBranch, Plus, Search, Check, X, Link2, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export interface AttributionEventItem {
  id: string;
  partnerId: string;
  partnerName: string | null;
  type: string;
  prospectEmail: string | null;
  prospectName: string | null;
  company: string | null;
  sourceDetail: string | null;
  recordedAt: string;
  proposalSentAt: string | null;
  isValid: boolean;
  notes: string | null;
}

export interface PartnerOption {
  id: string;
  name: string;
  refCode: string;
}

// datetime-local wants "yyyy-MM-dd'T'HH:mm" in LOCAL time.
function nowLocalInput(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function AttributionClient({
  initialEvents,
  partners,
}: {
  initialEvents: AttributionEventItem[];
  partners: PartnerOption[];
}) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => {
      return (
        (e.prospectEmail && e.prospectEmail.toLowerCase().includes(q)) ||
        (e.prospectName && e.prospectName.toLowerCase().includes(q)) ||
        (e.partnerName && e.partnerName.toLowerCase().includes(q))
      );
    });
  }, [events, search]);

  const handleCreated = (created: AttributionEventItem) => {
    setEvents((prev) => [created, ...prev]);
    toast.success("Direct introduction recorded");
    router.refresh();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-zinc-500" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Attribution events
            </h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Every tracked-link click and logged direct introduction. First
            valid event by recorded time wins attribution (Playbook §13).
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Record direct introduction
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          placeholder="Search prospect or partner…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Prospect email</TableHead>
                <TableHead>Prospect name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Recorded</TableHead>
                <TableHead>Proposal sent</TableHead>
                <TableHead className="text-center">Valid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-12 text-center text-sm text-zinc-500"
                  >
                    {events.length === 0
                      ? "No attribution events yet."
                      : "No events match your search."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      {e.partnerName ?? (
                        <span className="text-zinc-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {e.type === "tracked_link" ? (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Link2 className="h-3 w-3" />
                          Tracked link
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <UserPlus className="h-3 w-3" />
                          Direct intro
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.prospectEmail ?? (
                        <span className="text-zinc-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.prospectName ?? (
                        <span className="text-zinc-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.company ?? <span className="text-zinc-400">—</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-zinc-600">
                      {format(new Date(e.recordedAt), "MMM d, yyyy h:mm a")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-zinc-600">
                      {e.proposalSentAt ? (
                        format(new Date(e.proposalSentAt), "MMM d, yyyy h:mm a")
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {e.isValid ? (
                        <Check className="mx-auto h-4 w-4 text-emerald-600" />
                      ) : (
                        <X className="mx-auto h-4 w-4 text-red-600" />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecordIntroDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        partners={partners}
        onCreated={handleCreated}
      />
    </div>
  );
}

function RecordIntroDialog({
  open,
  onOpenChange,
  partners,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partners: PartnerOption[];
  onCreated: (e: AttributionEventItem) => void;
}) {
  const [partnerId, setPartnerId] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [prospectName, setProspectName] = useState("");
  const [company, setCompany] = useState("");
  const [sourceDetail, setSourceDetail] = useState("");
  const [recordedAt, setRecordedAt] = useState(nowLocalInput());
  const [proposalSentAt, setProposalSentAt] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Inline guard: an intro logged after the proposal won't win attribution.
  const lateIntro =
    !!recordedAt &&
    !!proposalSentAt &&
    new Date(recordedAt).getTime() > new Date(proposalSentAt).getTime();

  function reset() {
    setPartnerId("");
    setProspectEmail("");
    setProspectName("");
    setCompany("");
    setSourceDetail("");
    setRecordedAt(nowLocalInput());
    setProposalSentAt("");
    setNotes("");
  }

  async function handleSubmit() {
    if (!partnerId) {
      toast.error("Select a partner");
      return;
    }
    if (!prospectEmail.trim()) {
      toast.error("Prospect email is required");
      return;
    }
    if (!recordedAt) {
      toast.error("Recorded date is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/partners/attribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId,
          prospectEmail: prospectEmail.trim(),
          prospectName: prospectName.trim() || null,
          company: company.trim() || null,
          sourceDetail: sourceDetail.trim() || null,
          recordedAt: new Date(recordedAt).toISOString(),
          proposalSentAt: proposalSentAt
            ? new Date(proposalSentAt).toISOString()
            : null,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to record introduction");
        return;
      }

      const data = await res.json();
      const ev = data.event;
      const partner = partners.find((p) => p.id === partnerId);
      onCreated({
        id: ev.id,
        partnerId: ev.partnerId,
        partnerName: partner?.name ?? null,
        type: ev.type,
        prospectEmail: ev.prospectEmail,
        prospectName: ev.prospectName,
        company: ev.company,
        sourceDetail: ev.sourceDetail,
        recordedAt:
          typeof ev.recordedAt === "string"
            ? ev.recordedAt
            : new Date(ev.recordedAt).toISOString(),
        proposalSentAt: ev.proposalSentAt
          ? typeof ev.proposalSentAt === "string"
            ? ev.proposalSentAt
            : new Date(ev.proposalSentAt).toISOString()
          : null,
        isValid: ev.isValid,
        notes: ev.notes,
      });
      reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record direct introduction</DialogTitle>
          <DialogDescription>
            Log a partner-made introduction. To win attribution it must be
            recorded before the sales proposal goes out (Playbook §13).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Partner</Label>
            <Select value={partnerId} onValueChange={(v) => setPartnerId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select a partner…" />
              </SelectTrigger>
              <SelectContent>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.refCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prospectEmail">Prospect email</Label>
            <Input
              id="prospectEmail"
              type="email"
              required
              value={prospectEmail}
              onChange={(e) => setProspectEmail(e.target.value)}
              placeholder="prospect@company.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="prospectName">Prospect name</Label>
              <Input
                id="prospectName"
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceDetail">Source detail</Label>
            <Input
              id="sourceDetail"
              value={sourceDetail}
              onChange={(e) => setSourceDetail(e.target.value)}
              placeholder="e.g. warm intro over email"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="recordedAt">Recorded at</Label>
              <Input
                id="recordedAt"
                type="datetime-local"
                value={recordedAt}
                onChange={(e) => setRecordedAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proposalSentAt">Proposal sent at</Label>
              <Input
                id="proposalSentAt"
                type="datetime-local"
                value={proposalSentAt}
                onChange={(e) => setProposalSentAt(e.target.value)}
              />
            </div>
          </div>

          {lateIntro && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              This intro is logged after the proposal — it will be recorded but
              won&apos;t win attribution (Playbook §13).
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Recording…" : "Record introduction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
