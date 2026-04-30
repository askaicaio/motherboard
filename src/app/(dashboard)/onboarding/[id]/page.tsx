"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingStatusBadge } from "@/components/onboarding/status-badge";
import { ProvisioningTracker } from "@/components/onboarding/provisioning-tracker";
import { TOOL_DISPLAY_NAMES, DIVISIONS, type ToolKey, type OnboardingStatus, type ToolProvisionStatus } from "@/types";
import {
  CheckCircle2, Play, Mail, RefreshCw, ArrowLeft,
} from "lucide-react";

interface RequestDetail {
  id: string;
  employeeName: string;
  preferredName?: string;
  employeeEmail: string;
  personalEmail?: string;
  phone?: string;
  jobTitle: string;
  department: string;
  division: string;
  managerName?: string;
  managerEmail?: string;
  startDate: string;
  timezone?: string;
  employmentType?: string;
  location?: string;
  onboardingOwner?: string;
  notes?: string;
  status: OnboardingStatus;
  requestedTools: string[];
  createdAt: string;
  approvedAt?: string;
  provisioningSteps: Array<{
    id: string;
    toolKey: string;
    status: ToolProvisionStatus;
    errorMessage?: string | null;
    attemptCount: number;
    maxAttempts: number;
    resultData?: Record<string, unknown> | null;
    lastAttemptedAt?: string | null;
  }>;
  emails: Array<{
    id: string;
    subject: string;
    sentAt?: string;
    sentTo: string;
    resendCount: number;
  }>;
  auditHistory: Array<{
    id: string;
    action: string;
    actorEmail?: string;
    details: Record<string, unknown>;
    createdAt: string;
  }>;
}

export default function OnboardingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [emailPreview, setEmailPreview] = useState<string | null>(null);

  const id = params.id as string;

  useEffect(() => { fetchData(); }, [id]);

  async function fetchData() {
    setLoading(true);
    const res = await fetch(`/api/onboarding/${id}`);
    if (!res.ok) { router.push("/onboarding"); return; }
    setData(await res.json());
    setLoading(false);
  }

  async function handleAction(action: string, endpoint: string, method = "POST") {
    setActionLoading(action);
    try {
      const res = await fetch(endpoint, { method });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Action failed");
      }
      toast.success(`${action} successful`);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRetry(stepIds: string[]) {
    setActionLoading("retry");
    try {
      const res = await fetch(`/api/onboarding/${id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepIds }),
      });
      if (!res.ok) throw new Error("Retry failed");
      toast.success("Retry triggered");
      fetchData();
    } catch {
      toast.error("Failed to retry");
    } finally {
      setActionLoading(null);
    }
  }

  async function loadEmailPreview() {
    const res = await fetch(`/api/onboarding/${id}/email/preview`);
    if (res.ok) {
      const email = await res.json();
      setEmailPreview(email.html);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) return null;

  const divisionLabel = DIVISIONS.find((d) => d.value === data.division)?.label || data.division;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.push("/onboarding")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <h1 className="text-2xl font-semibold">{data.employeeName}</h1>
          <p className="text-sm text-zinc-500">
            {data.jobTitle} &middot; {data.department} &middot; {divisionLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <OnboardingStatusBadge status={data.status} />
          {data.status === "pending_approval" && (
            <Button onClick={() => handleAction("Approve", `/api/onboarding/${id}/approve`)} disabled={!!actionLoading}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {actionLoading === "Approve" ? "Approving..." : "Approve"}
            </Button>
          )}
          {data.status === "approved" && (
            <Button onClick={() => handleAction("Provision", `/api/onboarding/${id}/provision`)} disabled={!!actionLoading}>
              <Play className="mr-2 h-4 w-4" />
              {actionLoading === "Provision" ? "Starting..." : "Start Provisioning"}
            </Button>
          )}
          {["partially_provisioned", "awaiting_manual_action", "email_sent", "complete"].includes(data.status) && (
            <Button variant="outline" onClick={() => handleAction("Send Email", `/api/onboarding/${id}/email/send`)} disabled={!!actionLoading}>
              <Mail className="mr-2 h-4 w-4" />
              {data.emails.length > 0 ? "Resend Email" : "Send Email"}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="provisioning">
            Provisioning ({data.provisioningSteps.length})
          </TabsTrigger>
          <TabsTrigger value="email" onClick={loadEmailPreview}>Email</TabsTrigger>
          <TabsTrigger value="audit">Audit ({data.auditHistory.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Employee Details</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Email" value={data.employeeEmail} />
                <Row label="Personal Email" value={data.personalEmail} />
                <Row label="Phone" value={data.phone} />
                <Row label="Start Date" value={data.startDate ? format(new Date(data.startDate), "MMM d, yyyy") : undefined} />
                <Row label="Timezone" value={data.timezone} />
                <Row label="Employment" value={data.employmentType} />
                <Row label="Location" value={data.location} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Management & Tools</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Manager" value={data.managerName} />
                <Row label="Manager Email" value={data.managerEmail} />
                <Row label="Onboarding Owner" value={data.onboardingOwner} />
                <Separator className="my-2" />
                <div>
                  <span className="text-zinc-500">Tools: </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(data.requestedTools as string[]).map((t) => (
                      <Badge key={t} variant="outline" className="text-xs">
                        {TOOL_DISPLAY_NAMES[t as ToolKey] || t}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            {data.notes && (
              <Card className="col-span-2">
                <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-zinc-600 whitespace-pre-wrap">{data.notes}</p></CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="provisioning" className="mt-4">
          <ProvisioningTracker
            steps={data.provisioningSteps}
            onRetry={handleRetry}
            isRetrying={actionLoading === "retry"}
          />
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Email Preview</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={loadEmailPreview}>
                    <RefreshCw className="mr-1 h-3 w-3" /> Refresh
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAction(
                      data.emails.length > 0 ? "Resend" : "Send",
                      data.emails.length > 0 ? `/api/onboarding/${id}/email/resend` : `/api/onboarding/${id}/email/send`
                    )}
                    disabled={!!actionLoading}
                  >
                    <Mail className="mr-1 h-3 w-3" />
                    {data.emails.length > 0 ? "Resend" : "Send"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {emailPreview ? (
                <iframe
                  srcDoc={emailPreview}
                  className="h-[600px] w-full rounded border"
                  sandbox=""
                  title="Email Preview"
                />
              ) : (
                <p className="text-sm text-zinc-400">Click to load email preview.</p>
              )}
              {data.emails.length > 0 && (
                <div className="mt-4 space-y-1">
                  <p className="text-xs font-medium text-zinc-500">Send History</p>
                  {data.emails.map((e) => (
                    <p key={e.id} className="text-xs text-zinc-400">
                      Sent to {e.sentTo} on {e.sentAt ? format(new Date(e.sentAt), "MMM d, yyyy h:mm a") : "—"}
                      {e.resendCount > 0 && ` (resent ${e.resendCount}x)`}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {data.auditHistory.length > 0 ? (
                <div className="space-y-3">
                  {data.auditHistory.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 border-b pb-3 last:border-0">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {entry.action.replace(/_/g, " ")}
                          </Badge>
                          {entry.actorEmail && (
                            <span className="text-xs text-zinc-400">{entry.actorEmail}</span>
                          )}
                        </div>
                        {Object.keys(entry.details).length > 0 && (
                          <pre className="mt-1 text-xs text-zinc-500 overflow-hidden text-ellipsis">
                            {JSON.stringify(entry.details, null, 2).slice(0, 200)}
                          </pre>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400 whitespace-nowrap">
                        {format(new Date(entry.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-400 text-center py-8">No audit entries yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-900">{value || "—"}</span>
    </div>
  );
}
