// =============================================================
// Role-based access helpers (server + client safe)
// =============================================================

import type { AdminRole, Department } from "@/types";

/** Default email-domain hint shown to operators when env not set */
export const ALLOWED_EMAIL_DOMAIN_HINT = "chiefaiofficer.com";

/**
 * True for super_admin or admin. Non-admin "viewer" users (regular
 * Members) cannot perform privileged actions like inviting/deleting.
 */
export function isAdminRole(role: AdminRole | string | null | undefined): boolean {
  return role === "super_admin" || role === "admin";
}

/**
 * Who can see the Company Reports tab:
 *   - All admins
 *   - All members in the Sales department
 */
export function canSeeCompanyReports(
  role: AdminRole | string | null | undefined,
  department: Department | string | null | undefined,
): boolean {
  if (isAdminRole(role)) return true;
  return department === "sales";
}
