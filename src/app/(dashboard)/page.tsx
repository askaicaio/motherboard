"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingStatusBadge } from "@/components/onboarding/status-badge";
import { Users, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import type { OnboardingStatus } from "@/types";

interface DashboardData {
  data: Array<{
    id: string;
    employeeName: string;
    department: string;
    status: OnboardingStatus;
    startDate: string;
    createdAt: string;
  }>;
  pagination: { total: number };
}

export default function DashboardPage() {
  const [recent, setRecent] = useState<DashboardData | null>(null);
  const [pending, setPending] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const empty = { data: [], pagination: { total: 0 } };
    Promise.all([
      fetch("/api/onboarding?pageSize=5&sortOrder=desc").then((r) => r.ok ? r.json() : empty).catch(() => empty),
      fetch("/api/onboarding?status=pending_approval&pageSize=10").then((r) => r.ok ? r.json() : empty).catch(() => empty),
    ]).then(([recentData, pendingData]) => {
      setRecent(recentData);
      setPending(pendingData);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const totalRequests = recent?.pagination.total ?? 0;
  const pendingCount = pending?.pagination.total ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-500">CAIO Internal onboarding overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Requests" value={totalRequests} />
        <StatCard icon={Clock} label="Pending Approval" value={pendingCount} color="text-yellow-600" />
        <StatCard icon={AlertCircle} label="Action Required" value="—" color="text-orange-600" />
        <StatCard icon={CheckCircle2} label="Completed" value="—" color="text-green-600" />
      </div>

      {/* Recent */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {recent?.data.length ? (
              <div className="space-y-3">
                {recent.data.map((r) => (
                  <Link key={r.id} href={`/onboarding/${r.id}`} className="flex items-center justify-between rounded-md p-2 hover:bg-zinc-50">
                    <div>
                      <p className="text-sm font-medium">{r.employeeName}</p>
                      <p className="text-xs text-zinc-400">{r.department}</p>
                    </div>
                    <OnboardingStatusBadge status={r.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 text-center py-4">No requests yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            {pending?.data.length ? (
              <div className="space-y-3">
                {pending.data.map((r) => (
                  <Link key={r.id} href={`/onboarding/${r.id}`} className="flex items-center justify-between rounded-md p-2 hover:bg-zinc-50">
                    <div>
                      <p className="text-sm font-medium">{r.employeeName}</p>
                      <p className="text-xs text-zinc-400">
                        Starts {format(new Date(r.startDate), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                      Needs Approval
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 text-center py-4">All caught up!</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color = "text-zinc-900",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="rounded-lg bg-zinc-100 p-2">
          <Icon className="h-5 w-5 text-zinc-600" />
        </div>
        <div>
          <p className="text-xs text-zinc-500">{label}</p>
          <p className={`text-2xl font-semibold ${color}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
