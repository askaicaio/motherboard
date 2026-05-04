export interface Member {
  id: string;
  email: string;
  name: string;
  role: string; // 'super_admin' | 'admin' | 'viewer'
  department: string;
  isActive: boolean;
  archivedAt: string | Date | null;
  startedAt: string | Date | null;
  invitedAt: string | Date | null;
  lastLoginAt: string | Date | null;
  createdAt: string | Date;
}

export type SortKey =
  | "name_asc"
  | "name_desc"
  | "started_asc"
  | "started_desc"
  | "created_asc"
  | "created_desc";

export type GroupKey = "none" | "role" | "department";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name_asc", label: "Name (A-Z)" },
  { value: "name_desc", label: "Name (Z-A)" },
  { value: "started_desc", label: "Start date (newest first)" },
  { value: "started_asc", label: "Start date (oldest first)" },
  { value: "created_desc", label: "Added (newest first)" },
  { value: "created_asc", label: "Added (oldest first)" },
];

export const GROUP_OPTIONS: { value: GroupKey; label: string }[] = [
  { value: "none", label: "No grouping" },
  { value: "role", label: "Group by role" },
  { value: "department", label: "Group by department" },
];
