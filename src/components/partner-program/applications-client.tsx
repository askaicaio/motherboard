"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Users, CheckCircle, XCircle, Inbox } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

export interface ApplicationRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  notes: string | null;
  appliedAt: string;
}

interface Props {
  initialApplications: ApplicationRow[];
}

export function ApplicationsClient({ initialApplications }: Props) {
  const [applications, setApplications] =
    useState<ApplicationRow[]>(initialApplications);
  const [declineTarget, setDeclineTarget] = useState<ApplicationRow | null>(
    null,
  );
  const [declineReason, setDeclineReason] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleApprove(app: ApplicationRow) {
    setLoadingId(app.id);
    try {
      const res = await fetch(`/api/partners/${app.id}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setApplications((prev) => prev.filter((a) => a.id !== app.id));
      toast.success(`${app.name} approved — welcome email sent.`);
    } catch (err) {
      toast.error(
        `Approval failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setLoadingId(null);
    }
  }

  function openDecline(app: ApplicationRow) {
    setDeclineTarget(app);
    setDeclineReason("");
  }

  async function handleDecline() {
    if (!declineTarget) return;
    setLoadingId(declineTarget.id);
    try {
      const res = await fetch(`/api/partners/${declineTarget.id}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setApplications((prev) =>
        prev.filter((a) => a.id !== declineTarget.id),
      );
      toast.success(`${declineTarget.name}'s application declined.`);
      setDeclineTarget(null);
    } catch (err) {
      toast.error(
        `Decline failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="h-7 w-7 text-indigo-600 shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Partner Applications
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review and action incoming partner program applications.
          </p>
        </div>
        {applications.length > 0 && (
          <Badge className="ml-auto" variant="secondary">
            {applications.length} pending
          </Badge>
        )}
      </div>

      {/* Content */}
      {applications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <Inbox className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">
              No pending applications
            </p>
            <p className="text-sm text-muted-foreground/70">
              New applications will appear here as they come in.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Notes / Message</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => {
                  const busy = loadingId === app.id;
                  return (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">{app.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {app.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {app.company ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {format(parseISO(app.appliedAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {app.notes ? (
                          <span className="line-clamp-2 text-sm text-muted-foreground">
                            {app.notes}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40 text-sm">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                            disabled={busy}
                            onClick={() => openDecline(app)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Decline
                          </Button>
                          <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            disabled={busy}
                            onClick={() => handleApprove(app)}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Approve
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Decline dialog */}
      <Dialog
        open={!!declineTarget}
        onOpenChange={(open) => {
          if (!open) setDeclineTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Application</DialogTitle>
            <DialogDescription>
              Declining{" "}
              <strong>{declineTarget?.name}</strong> (
              {declineTarget?.email}). Optionally provide a reason for your
              records.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="decline-reason">Reason (optional)</Label>
            <Textarea
              id="decline-reason"
              placeholder="e.g. Audience doesn't align with our ICP…"
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeclineTarget(null)}
              disabled={!!loadingId}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!!loadingId}
              onClick={handleDecline}
            >
              Confirm Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
