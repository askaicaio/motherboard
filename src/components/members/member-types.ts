export interface Member {
  id: string;
  email: string;
  name: string;
  role: string; // 'super_admin' | 'admin' | 'viewer'
  department: string;
  /** Company job title (e.g. "Senior Account Manager"). */
  jobTitle: string | null;
  location: string | null;
  managerId: string | null;
  phone: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  archivedAt: string | Date | null;
  startedAt: string | Date | null;
  invitedAt: string | Date | null;
  lastLoginAt: string | Date | null;
  createdAt: string | Date;
}

/** Which columns to render in the table. Persisted in localStorage. */
export type ColumnKey =
  | "name"
  | "role"
  | "department"
  | "jobTitle"
  | "location"
  | "phone"
  | "status"
  | "started"
  | "invited"
  | "lastLogin"
  | "createdAt";

export const COLUMN_DEFINITIONS: { key: ColumnKey; label: string; default: boolean }[] = [
  { key: "name", label: "Name", default: true },
  { key: "role", label: "Role", default: true },
  { key: "department", label: "Department", default: true },
  { key: "jobTitle", label: "Job Title", default: true },
  { key: "location", label: "Location", default: false },
  { key: "phone", label: "Phone", default: false },
  { key: "status", label: "Status", default: true },
  { key: "started", label: "Started", default: true },
  { key: "invited", label: "Invited", default: false },
  { key: "lastLogin", label: "Last login", default: true },
  { key: "createdAt", label: "Date Added", default: false },
];

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
