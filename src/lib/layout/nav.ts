// =============================================================
// Canonical navigation registry
// =============================================================
// Single source of truth for the sidebar's manageable tabs. Both the
// Sidebar (which attaches icons + role predicates) and the per-department
// visibility editor import from here so the two never drift.
//
// Dashboard ("/") is intentionally NOT manageable — it's the home tab and
// always visible to everyone.
// =============================================================

export interface ManageableTab {
  href: string;
  label: string;
}

export const MANAGEABLE_TABS: ManageableTab[] = [
  { href: "/onboarding", label: "Onboarding" },
  { href: "/onboarding/new", label: "New Request" },
  { href: "/reports", label: "Company Reports" },
  { href: "/members", label: "Members" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/automations", label: "Automations" },
  { href: "/docs", label: "Docs" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/partner-program", label: "Partner Program" },
  { href: "/integrations", label: "Integrations" },
  { href: "/audit-log", label: "Audit Log" },
  { href: "/settings/rules", label: "Rules" },
  { href: "/settings", label: "Settings" },
];

/**
 * Department → list of HIDDEN tab hrefs. A deny-list (rather than an
 * allow-list) so newly-added tabs are visible by default until someone
 * explicitly hides them for a department.
 */
export type DepartmentTabVisibility = Record<string, string[]>;

export const DEPARTMENT_VISIBILITY_SETTINGS_KEY = "department_tab_visibility";

/** Hrefs hidden for a department (empty when unset). */
export function hiddenTabsForDepartment(
  config: DepartmentTabVisibility | null | undefined,
  department: string | undefined,
): string[] {
  if (!config || !department) return [];
  return config[department] ?? [];
}
