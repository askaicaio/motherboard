"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditAction } from "@/types";

const AUDIT_ACTIONS: AuditAction[] = [
  "request_created", "request_updated", "request_approved", "request_rejected",
  "provisioning_started", "provisioning_step_started", "provisioning_step_completed",
  "provisioning_step_failed", "provisioning_retried", "email_generated",
  "email_sent", "email_resent", "status_changed", "rule_created",
  "rule_updated", "rule_deleted", "settings_updated", "manual_override",
];

interface AuditEntry {
  id: string;
  action: AuditAction;
  actorEmail?: string;
  requestId?: string;
  details: Record<string, unknown>;
  createdAt: string;
}

interface AuditResponse {
  data: AuditEntry[];
  pagination: { page: number; totalPages: number; total: number };
}

export default function AuditLogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState(searchParams.get("action") || "all");

  const page = Number(searchParams.get("page") || "1");

  useEffect(() => {
    const params = new URLSearchParams();
    if (actionFilter && actionFilter !== "all") params.set("action", actionFilter);
    params.set("page", String(page));

    fetch(`/api/audit-log?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [searchParams.toString(), actionFilter]);

  function applyFilters() {
    const params = new URLSearchParams();
    if (actionFilter && actionFilter !== "all") params.set("action", actionFilter);
    params.set("page", "1");
    router.push(`/audit-log?${params}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-zinc-500">{data?.pagination.total ?? 0} entries</p>
      </div>

      <div className="flex gap-3">
        <Select value={actionFilter} onValueChange={(v) => setActionFilter(v ?? "all")}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {AUDIT_ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={applyFilters}>Apply</Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-4">
            {data?.data.length ? (
              <div className="divide-y">
                {data.data.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {entry.action.replace(/_/g, " ")}
                        </Badge>
                        {entry.actorEmail && (
                          <span className="text-xs text-zinc-400">{entry.actorEmail}</span>
                        )}
                        {entry.requestId && (
                          <button
                            onClick={() => router.push(`/onboarding/${entry.requestId}`)}
                            className="text-xs text-blue-500 hover:underline"
                          >
                            View request
                          </button>
                        )}
                      </div>
                      <pre className="text-xs text-zinc-500 max-w-lg overflow-hidden text-ellipsis">
                        {JSON.stringify(entry.details, null, 2).slice(0, 150)}
                      </pre>
                    </div>
                    <span className="text-xs text-zinc-400 whitespace-nowrap">
                      {format(new Date(entry.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 text-center py-8">No audit entries found.</p>
            )}
          </CardContent>
        </Card>
      )}

      {data && data.pagination.totalPages > 1 && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-zinc-500">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1}
              onClick={() => router.push(`/audit-log?page=${page - 1}${actionFilter !== "all" ? `&action=${actionFilter}` : ""}`)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.pagination.totalPages}
              onClick={() => router.push(`/audit-log?page=${page + 1}${actionFilter !== "all" ? `&action=${actionFilter}` : ""}`)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
