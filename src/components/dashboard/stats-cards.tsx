import { Card, CardContent } from "@/components/ui/card";
import {
  Users, Clock, Loader2, AlertTriangle, ClipboardCheck,
} from "lucide-react";
import Link from "next/link";

interface StatsCardsProps {
  totalActive: number;
  pendingApproval: number;
  inProgress: number;
  needsAttention: number;
  manualTasksPending: number;
}

export function StatsCards({
  totalActive,
  pendingApproval,
  inProgress,
  needsAttention,
  manualTasksPending,
}: StatsCardsProps) {
  const cards = [
    {
      label: "Active Requests",
      value: totalActive,
      icon: Users,
      href: "/onboarding",
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Pending Approval",
      value: pendingApproval,
      icon: Clock,
      href: "/onboarding?status=pending_approval",
      iconColor: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      label: "Provisioning",
      value: inProgress,
      icon: Loader2,
      href: "/onboarding?status=provisioning_in_progress",
      iconColor: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      label: "Needs Attention",
      value: needsAttention,
      icon: AlertTriangle,
      href: "/onboarding?status=failed",
      iconColor: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      label: "Manual Tasks",
      value: manualTasksPending,
      icon: ClipboardCheck,
      href: "/manual-tasks",
      iconColor: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Link key={card.label} href={card.href}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`${card.bgColor} p-2.5 rounded-lg`}>
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
