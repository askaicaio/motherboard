"use client";

import { ColumnDef } from "@tanstack/react-table";
import { OnboardingStatusBadge } from "./status-badge";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import Link from "next/link";
import type { OnboardingStatus, DivisionType } from "@/types";

export type OnboardingRequestRow = {
  id: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  division: DivisionType;
  jobTitle: string;
  startDate: string;
  status: OnboardingStatus;
  createdAt: string;
  requestedTools: string[];
};

export const columns: ColumnDef<OnboardingRequestRow>[] = [
  {
    accessorKey: "employeeName",
    header: "Employee",
    cell: ({ row }) => (
      <Link
        href={`/onboarding/${row.original.id}`}
        className="font-medium text-zinc-900 hover:underline"
      >
        {row.getValue("employeeName")}
      </Link>
    ),
  },
  {
    accessorKey: "department",
    header: "Department",
    cell: ({ row }) => (
      <span className="text-zinc-600">{row.getValue("department")}</span>
    ),
  },
  {
    accessorKey: "division",
    header: "Division",
    cell: ({ row }) => (
      <Badge variant="outline" className="uppercase text-xs">
        {row.getValue("division")}
      </Badge>
    ),
  },
  {
    accessorKey: "jobTitle",
    header: "Role",
    cell: ({ row }) => (
      <span className="text-zinc-600">{row.getValue("jobTitle")}</span>
    ),
  },
  {
    accessorKey: "startDate",
    header: "Start Date",
    cell: ({ row }) => {
      const date = row.getValue("startDate") as string;
      return <span className="text-zinc-600">{date ? format(new Date(date), "MMM d, yyyy") : "—"}</span>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <OnboardingStatusBadge status={row.getValue("status")} />
    ),
  },
  {
    accessorKey: "requestedTools",
    header: "Tools",
    cell: ({ row }) => {
      const tools = row.getValue("requestedTools") as string[];
      return (
        <span className="text-xs text-zinc-500">
          {tools?.length ?? 0} tool{(tools?.length ?? 0) !== 1 ? "s" : ""}
        </span>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => {
      const date = row.getValue("createdAt") as string;
      return (
        <span className="text-xs text-zinc-400">
          {format(new Date(date), "MMM d, yyyy")}
        </span>
      );
    },
  },
];
